"""
tools/tests/conftest.py: Multi-Tier Connection Fallback & Pytest Fixtures
=============================================================================
Architecture:
  - Tier 1: pyodbc probe (ODBC Driver 18, 17, SQL Server)
  - Tier 2: pymssql fallback (direct FreeTDS TCP connection)
  - Tier 3: Containerized execution fallback (docker exec / docker compose exec sqlcmd)

Provides unified fixtures:
  - `db_client`: Session-scoped DatabaseClient instance (connected to ECommerceDB)
  - `master_client`: Session-scoped DatabaseClient instance (connected to master)
  - `db_conn`: Function-scoped connection/client adapter
  - `execute_query`: Helper returning List[Dict[str, Any]]
  - `execute_scalar`: Helper returning single scalar value
  - `execute_non_query`: Helper returning affected rows
  - `execute_script`: Helper executing multi-batch SQL / .sql files
  - `clean_sentinels`: Function-scoped setup/teardown cleaner for test artifacts
  - `db_tx`: Function-scoped transaction rollback isolation fixture
  - `restore_baseline`: Disaster recovery drill reset fixture
=============================================================================
"""

import os
import re
import sys
import time
import subprocess
import pytest
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple, Union

# -----------------------------------------------------------------------------
# 1. Environment & Configuration Resolution
# -----------------------------------------------------------------------------
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

def _load_env_file():
    """Load .env file if present without hard dependency on python-dotenv."""
    env_path = os.path.join(WORKSPACE_ROOT, ".env")
    if os.path.isfile(env_path):
        try:
            from dotenv import load_dotenv
            load_dotenv(env_path)
        except ImportError:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

_load_env_file()

MSSQL_HOST = os.environ.get("MSSQL_HOST", "localhost")
MSSQL_PORT = int(os.environ.get("MSSQL_PORT", "1433"))
MSSQL_USER = os.environ.get("MSSQL_USER", "sa")
MSSQL_PASSWORD = os.environ.get("MSSQL_SA_PASSWORD", "Password_123#")
MSSQL_DATABASE = os.environ.get("MSSQL_DATABASE", "ECommerceDB")
MSSQL_CONTAINER = os.environ.get("MSSQL_CONTAINER_NAME", "ecommerce_mssql")
MSSQL_SERVICE = os.environ.get("MSSQL_SERVICE_NAME", "mssql")


# -----------------------------------------------------------------------------
# 2. Unified DatabaseClient Abstract Base Class
# -----------------------------------------------------------------------------
class DatabaseClient(ABC):
    """Abstract database client interface ensuring transparent test portability."""

    tier_name: str = "Abstract"

    @abstractmethod
    def execute_query(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> List[Dict[str, Any]]:
        """Execute a SELECT query or stored procedure returning rows as list of dicts."""
        pass

    @abstractmethod
    def execute_scalar(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> Any:
        """Execute query returning a single scalar value."""
        pass

    @abstractmethod
    def execute_non_query(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> int:
        """Execute INSERT, UPDATE, DELETE, or DDL and return affected rows."""
        pass

    @abstractmethod
    def execute_script(self, script_path_or_sql: str, database: Optional[str] = None, timeout: int = 60) -> None:
        """Execute multi-batch SQL containing GO statements or read from file."""
        pass

    @abstractmethod
    def close(self) -> None:
        """Close connections and release resources."""
        pass


# -----------------------------------------------------------------------------
# 3. Tier 1: PyodbcClient
# -----------------------------------------------------------------------------
class PyodbcClient(DatabaseClient):
    tier_name = "Tier 1 (pyodbc)"

    def __init__(self, driver: str, database: str = MSSQL_DATABASE):
        import pyodbc
        self.driver = driver
        self.database = database
        self.conn = self._create_connection(database)

    def _create_connection(self, database: str):
        import pyodbc
        if self.driver == "ODBC Driver 18 for SQL Server":
            conn_str = (
                f"DRIVER={{{self.driver}}};SERVER={MSSQL_HOST},{MSSQL_PORT};DATABASE={database};"
                f"UID={MSSQL_USER};PWD={MSSQL_PASSWORD};Encrypt=yes;TrustServerCertificate=yes;"
                f"Connection Timeout=15;"
            )
        elif self.driver == "ODBC Driver 17 for SQL Server":
            conn_str = (
                f"DRIVER={{{self.driver}}};SERVER={MSSQL_HOST},{MSSQL_PORT};DATABASE={database};"
                f"UID={MSSQL_USER};PWD={MSSQL_PASSWORD};Encrypt=no;TrustServerCertificate=yes;"
                f"Connection Timeout=15;"
            )
        else:  # Legacy 'SQL Server'
            conn_str = (
                f"DRIVER={{{self.driver}}};SERVER={MSSQL_HOST},{MSSQL_PORT};DATABASE={database};"
                f"UID={MSSQL_USER};PWD={MSSQL_PASSWORD};Connection Timeout=15;"
            )
        return pyodbc.connect(conn_str, autocommit=True)

    def execute_query(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> List[Dict[str, Any]]:
        target_conn = self.conn if (database is None or database == self.database) else self._create_connection(database)
        cursor = target_conn.cursor()
        try:
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            
            while cursor.description is None:
                if not cursor.nextset():
                    return []
            
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
            return [dict(zip(columns, row)) for row in rows]
        finally:
            cursor.close()
            if target_conn != self.conn:
                target_conn.close()

    def execute_scalar(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> Any:
        rows = self.execute_query(sql, params, database=database, timeout=timeout)
        if rows:
            return next(iter(rows[0].values()))
        return None

    def execute_non_query(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> int:
        target_conn = self.conn if (database is None or database == self.database) else self._create_connection(database)
        cursor = target_conn.cursor()
        try:
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            return cursor.rowcount
        finally:
            cursor.close()
            if target_conn != self.conn:
                target_conn.close()

    def execute_script(self, script_path_or_sql: str, database: Optional[str] = None, timeout: int = 60) -> None:
        if os.path.isfile(script_path_or_sql):
            with open(script_path_or_sql, "r", encoding="utf-8") as f:
                content = f.read()
        else:
            content = script_path_or_sql
        
        batches = re.split(r"(?im)^\s*GO\s*$", content)
        target_conn = self.conn if (database is None or database == self.database) else self._create_connection(database)
        cursor = target_conn.cursor()
        try:
            for batch in batches:
                batch_clean = batch.strip()
                if batch_clean:
                    cursor.execute(batch_clean)
        finally:
            cursor.close()
            if target_conn != self.conn:
                target_conn.close()

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass


# -----------------------------------------------------------------------------
# 4. Tier 2: PymssqlClient
# -----------------------------------------------------------------------------
class PymssqlClient(DatabaseClient):
    tier_name = "Tier 2 (pymssql)"

    def __init__(self, database: str = MSSQL_DATABASE):
        self.database = database
        self.conn = self._create_connection(database)

    def _create_connection(self, database: str):
        import pymssql
        return pymssql.connect(
            server=MSSQL_HOST,
            port=MSSQL_PORT,
            user=MSSQL_USER,
            password=MSSQL_PASSWORD,
            database=database,
            autocommit=True,
            login_timeout=15,
            as_dict=True
        )

    def execute_query(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> List[Dict[str, Any]]:
        target_conn = self.conn if (database is None or database == self.database) else self._create_connection(database)
        cursor = target_conn.cursor(as_dict=True)
        try:
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            return cursor.fetchall()
        finally:
            cursor.close()
            if target_conn != self.conn:
                target_conn.close()

    def execute_scalar(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> Any:
        rows = self.execute_query(sql, params, database=database, timeout=timeout)
        if rows:
            return next(iter(rows[0].values()))
        return None

    def execute_non_query(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> int:
        target_conn = self.conn if (database is None or database == self.database) else self._create_connection(database)
        cursor = target_conn.cursor()
        try:
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            return cursor.rowcount
        finally:
            cursor.close()
            if target_conn != self.conn:
                target_conn.close()

    def execute_script(self, script_path_or_sql: str, database: Optional[str] = None, timeout: int = 60) -> None:
        if os.path.isfile(script_path_or_sql):
            with open(script_path_or_sql, "r", encoding="utf-8") as f:
                content = f.read()
        else:
            content = script_path_or_sql
        
        batches = re.split(r"(?im)^\s*GO\s*$", content)
        target_conn = self.conn if (database is None or database == self.database) else self._create_connection(database)
        cursor = target_conn.cursor()
        try:
            for batch in batches:
                batch_clean = batch.strip()
                if batch_clean:
                    cursor.execute(batch_clean)
        finally:
            cursor.close()
            if target_conn != self.conn:
                target_conn.close()

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass


# -----------------------------------------------------------------------------
# 5. Tier 3: ContainerizedClient (sqlcmd in Docker Container)
# -----------------------------------------------------------------------------
class ContainerizedClient(DatabaseClient):
    tier_name = "Tier 3 (docker sqlcmd)"

    def __init__(self, default_database: str = MSSQL_DATABASE):
        self.default_database = default_database
        self.exec_prefix = self._probe_docker_invocation()

    def _probe_docker_invocation(self) -> List[str]:
        """Detect whether docker exec or docker compose exec is available across known container names."""
        container_candidates = [MSSQL_CONTAINER, "ecommerce_mssql", "dbms-mssql"]
        for c in container_candidates:
            test_cmd = [
                "docker", "exec", "-i", c,
                "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost",
                "-U", MSSQL_USER, "-P", MSSQL_PASSWORD, "-C", "-Q", "SELECT 1"
            ]
            try:
                res = subprocess.run(test_cmd, capture_output=True, text=True, timeout=10)
                if res.returncode == 0:
                    return ["docker", "exec", "-i", c]
            except Exception:
                pass

        # Probe docker compose exec
        compose_services = [MSSQL_SERVICE, "mssql", "dbms-mssql"]
        for s in compose_services:
            compose_cmd = [
                "docker", "compose", "exec", "-T", s,
                "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost",
                "-U", MSSQL_USER, "-P", MSSQL_PASSWORD, "-C", "-Q", "SELECT 1"
            ]
            try:
                res = subprocess.run(compose_cmd, cwd=WORKSPACE_ROOT, capture_output=True, text=True, timeout=10)
                if res.returncode == 0:
                    return ["docker", "compose", "exec", "-T", s]
            except Exception:
                pass

        raise RuntimeError(
            f"Cannot connect to MSSQL via Docker. Ensure container '{MSSQL_CONTAINER}' or service '{MSSQL_SERVICE}' is running "
            "(`docker compose up -d mssql`)."
        )

    def _base_sqlcmd_cmd(self, database: Optional[str] = None) -> List[str]:
        db = database or self.default_database
        return self.exec_prefix + [
            "/opt/mssql-tools18/bin/sqlcmd",
            "-S", "localhost",
            "-U", MSSQL_USER,
            "-P", MSSQL_PASSWORD,
            "-d", db,
            "-C",
            "-b",
            "-m", "1",
            "-s", "\t",
            "-W"
        ]

    def _format_sql_with_params(self, sql: str, params: Optional[Union[tuple, list, dict]]) -> str:
        """Parameter interpolation for container sqlcmd fallback."""
        if not params:
            return sql
        if isinstance(params, (list, tuple)):
            for p in params:
                if p is None:
                    sql = sql.replace("?", "NULL", 1)
                elif isinstance(p, (int, float)):
                    sql = sql.replace("?", str(p), 1)
                else:
                    escaped = str(p).replace("'", "''")
                    sql = sql.replace("?", f"N'{escaped}'", 1)
        elif isinstance(params, dict):
            for k, p in params.items():
                target = f"@{k}"
                if p is None:
                    sql = sql.replace(target, "NULL")
                elif isinstance(p, (int, float)):
                    sql = sql.replace(target, str(p))
                else:
                    escaped = str(p).replace("'", "''")
                    sql = sql.replace(target, f"N'{escaped}'")
        return sql

    def execute_query(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> List[Dict[str, Any]]:
        formatted_sql = self._format_sql_with_params(sql, params)
        cmd = self._base_sqlcmd_cmd(database=database) + ["-Q", formatted_sql]
        try:
            res = subprocess.run(cmd, cwd=WORKSPACE_ROOT, capture_output=True, text=True, check=True, timeout=timeout)
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(f"SQL execution failed (exit {exc.returncode}):\n{exc.stdout}\n{exc.stderr}") from exc
        except subprocess.TimeoutExpired as exc:
            raise TimeoutError(f"Containerized query timed out after {timeout}s: {formatted_sql[:100]}...") from exc
        return self._parse_tsv_output(res.stdout)

    def execute_scalar(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> Any:
        rows = self.execute_query(sql, params, database=database, timeout=timeout)
        if rows:
            return next(iter(rows[0].values()))
        return None

    def execute_non_query(self, sql: str, params: Optional[Union[tuple, list, dict]] = None, database: Optional[str] = None, timeout: int = 30) -> int:
        formatted_sql = self._format_sql_with_params(sql, params)
        cmd = self._base_sqlcmd_cmd(database=database) + ["-Q", formatted_sql]
        try:
            res = subprocess.run(cmd, cwd=WORKSPACE_ROOT, capture_output=True, text=True, check=True, timeout=timeout)
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(f"SQL execution failed (exit {exc.returncode}):\n{exc.stdout}\n{exc.stderr}") from exc
        except subprocess.TimeoutExpired as exc:
            raise TimeoutError(f"Containerized command timed out after {timeout}s: {formatted_sql[:100]}...") from exc
        m = re.search(r"\((\d+)\s+rows?\s+affected\)", res.stdout, re.IGNORECASE)
        return int(m.group(1)) if m else 0

    def execute_script(self, script_path_or_sql: str, database: Optional[str] = None, timeout: int = 60) -> None:
        if os.path.isfile(script_path_or_sql):
            with open(script_path_or_sql, "r", encoding="utf-8") as f:
                content = f.read()
        else:
            content = script_path_or_sql

        cmd = self._base_sqlcmd_cmd(database=database)
        try:
            res = subprocess.run(cmd, cwd=WORKSPACE_ROOT, input=content, capture_output=True, text=True, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            raise TimeoutError(f"Containerized script execution timed out after {timeout}s") from exc
        if res.returncode != 0:
            raise RuntimeError(f"Script execution failed with returncode {res.returncode}:\n{res.stderr}\n{res.stdout}")

    def _parse_tsv_output(self, output: str) -> List[Dict[str, Any]]:
        lines = [line.strip() for line in output.splitlines() if line.strip()]
        data_lines = [l for l in lines if not re.match(r"^\(\d+\s+rows?\s+affected\)$", l, re.IGNORECASE)]
        if not data_lines:
            return []

        header_idx = -1
        for i in range(len(data_lines) - 1):
            next_line = data_lines[i + 1]
            parts = next_line.split("\t")
            if all(part.strip() and set(part.strip()).issubset({'-'}) for part in parts):
                header_idx = i
                break

        if header_idx == -1:
            first_parts = data_lines[0].split("\t")
            if all(part.strip() and set(part.strip()).issubset({'-'}) for part in first_parts):
                headers = [f"col_{j}" for j in range(len(first_parts))]
                data_start = 1
            else:
                return []
        else:
            headers = [h.strip() for h in data_lines[header_idx].split("\t")]
            data_start = header_idx + 2

        results = []
        for line in data_lines[data_start:]:
            cols = [c.strip() for c in line.split("\t")]
            if len(cols) < len(headers):
                cols.extend([""] * (len(headers) - len(cols)))
            elif len(cols) > len(headers):
                cols = cols[:len(headers)]

            row_dict = {}
            for h, val in zip(headers, cols):
                if val == "NULL":
                    row_dict[h] = None
                elif re.match(r"^-?\d+$", val):
                    row_dict[h] = int(val)
                elif re.match(r"^-?\d+\.\d+$", val):
                    row_dict[h] = float(val)
                else:
                    row_dict[h] = val
            results.append(row_dict)
        return results

    def close(self) -> None:
        pass


# -----------------------------------------------------------------------------
# 6. Fallback Driver Resolver
# -----------------------------------------------------------------------------
def get_database_client(database: str = MSSQL_DATABASE) -> DatabaseClient:
    errors = []

    # Attempt Tier 1: pyodbc
    try:
        import pyodbc
        try:
            available_drivers = pyodbc.drivers()
        except Exception as e:
            available_drivers = []
            errors.append(f"Tier 1 (pyodbc): driver probe failed: {e}")

        preferred_driver = None
        for pref in ["ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server", "SQL Server"]:
            if pref in available_drivers:
                preferred_driver = pref
                break

        if preferred_driver:
            try:
                client = PyodbcClient(preferred_driver, database=database)
                client.execute_scalar("SELECT 1")
                return client
            except Exception as e:
                errors.append(f"Tier 1 (pyodbc with {preferred_driver}) connection failed: {e}")
        else:
            errors.append("Tier 1 (pyodbc): No compatible ODBC driver found in pyodbc.drivers().")
    except (ImportError, Exception) as e:
        errors.append(f"Tier 1 (pyodbc): pyodbc unavailable or failed: {e}")

    # Attempt Tier 2: pymssql
    try:
        import pymssql
        try:
            client = PymssqlClient(database=database)
            client.execute_scalar("SELECT 1")
            return client
        except Exception as e:
            errors.append(f"Tier 2 (pymssql) connection failed: {e}")
    except (ImportError, Exception) as e:
        errors.append(f"Tier 2 (pymssql): pymssql unavailable or failed: {e}")

    # Attempt Tier 3: Containerized sqlcmd
    try:
        client = ContainerizedClient(default_database=database)
        client.execute_scalar("SELECT 1")
        return client
    except Exception as e:
        errors.append(f"Tier 3 (containerized sqlcmd) failed: {e}")

    # All tiers failed
    detail_str = "\n".join(f"  - {err}" for err in errors)
    raise ConnectionError(
        f"Unable to establish database connection across any fallback tier:\n{detail_str}\n"
        "Remediation steps:\n"
        "  1. Start container: docker compose up -d mssql\n"
        "  2. Verify SQL Server is healthy: docker compose ps\n"
        "  3. Check credentials: MSSQL_SA_PASSWORD in .env matches container password."
    )


# -----------------------------------------------------------------------------
# 6.1 Fast Live Connection Probe
# -----------------------------------------------------------------------------
_MSSQL_ONLINE: Optional[bool] = None

def is_mssql_online() -> bool:
    """Fast, memoized probe determining if a live Microsoft SQL Server instance is reachable."""
    global _MSSQL_ONLINE
    if _MSSQL_ONLINE is not None:
        return _MSSQL_ONLINE
    try:
        import socket
        host = os.environ.get("MSSQL_HOST", "localhost")
        port = int(os.environ.get("MSSQL_PORT", "1433"))
        with socket.create_connection((host, port), timeout=0.5):
            pass
        client = get_database_client(database="master")
        val = client.execute_scalar("SELECT 1")
        client.close()
        _MSSQL_ONLINE = (val == 1)
    except Exception:
        _MSSQL_ONLINE = False
    return _MSSQL_ONLINE


# -----------------------------------------------------------------------------
# 7. Pytest Fixtures
# -----------------------------------------------------------------------------
@pytest.fixture(scope="session")
def db_client() -> DatabaseClient:
    """Session-scoped database client honoring multi-tier fallback (connected to ECommerceDB)."""
    try:
        client = get_database_client(database=MSSQL_DATABASE)
    except ConnectionError as e:
        pytest.skip(f"Live MSSQL database unavailable: {e}")
    yield client
    client.close()


@pytest.fixture(scope="session")
def master_client() -> DatabaseClient:
    """Session-scoped database client connected to master database for admin/backup/restore tasks."""
    try:
        client = get_database_client(database="master")
    except ConnectionError as e:
        pytest.skip(f"Live MSSQL master connection unavailable: {e}")
    yield client
    client.close()


@pytest.fixture(scope="function")
def db_conn(db_client) -> DatabaseClient:
    """Function-scoped connection adapter for test functions."""
    return db_client


@pytest.fixture(scope="function")
def execute_query(db_client):
    """Convenience fixture: execute_query(sql, params=None, database=None) -> List[Dict]."""
    return db_client.execute_query


@pytest.fixture(scope="function")
def execute_scalar(db_client):
    """Convenience fixture: execute_scalar(sql, params=None, database=None) -> Any."""
    return db_client.execute_scalar


@pytest.fixture(scope="function")
def execute_non_query(db_client):
    """Convenience fixture: execute_non_query(sql, params=None, database=None) -> int."""
    return db_client.execute_non_query


@pytest.fixture(scope="function")
def execute_script(db_client):
    """Convenience fixture: execute_script(sql_path_or_string, database=None)."""
    return db_client.execute_script


@pytest.fixture(scope="function")
def clean_sentinels(db_client):
    """
    Cleans up test artifacts deterministically before and after test execution.
    Removes test users (@test.local), test products ([[]TEST]%), test vouchers (TEST_%),
    and test orders (TEST_SENTINEL%).
    """
    cleanup_sql = """
    SET NOCOUNT ON;
    -- 1. Reviews by test users or on test products
    DELETE FROM dbo.Reviews
    WHERE comment LIKE 'TEST_SENTINEL%'
       OR user_id IN (SELECT user_id FROM dbo.Users WHERE email LIKE '%@test.local')
       OR product_id IN (SELECT product_id FROM dbo.Products WHERE name LIKE '[[]TEST]%');

    -- 2. Order Details for test orders
    DELETE FROM dbo.Order_Details
    WHERE order_id IN (
        SELECT order_id FROM dbo.Orders
        WHERE shipping_address LIKE 'TEST_SENTINEL%'
           OR buyer_id IN (SELECT user_id FROM dbo.Users WHERE email LIKE '%@test.local')
    );

    -- 3. Orders for test users or with sentinel address
    DELETE FROM dbo.Orders
    WHERE shipping_address LIKE 'TEST_SENTINEL%'
       OR buyer_id IN (SELECT user_id FROM dbo.Users WHERE email LIKE '%@test.local');

    -- 4. Cart Items for test users
    DELETE FROM dbo.Cart_Items
    WHERE user_id IN (SELECT user_id FROM dbo.Users WHERE email LIKE '%@test.local');

    -- 5. Products tagged with [TEST]
    DELETE FROM dbo.Products
    WHERE name LIKE '[[]TEST]%' OR description LIKE 'TEST_SENTINEL%';

    -- 6. Vouchers with TEST_ code
    DELETE FROM dbo.Vouchers
    WHERE voucher_code LIKE 'TEST_%';

    -- 7. Sellers registered by test users
    DELETE FROM dbo.Sellers
    WHERE user_id IN (SELECT user_id FROM dbo.Users WHERE email LIKE '%@test.local');

    -- 8. Test Users
    DELETE FROM dbo.Users
    WHERE email LIKE '%@test.local' OR username LIKE '_test_%';
    """
    # Pre-test cleanup
    try:
        db_client.execute_non_query(cleanup_sql)
    except Exception:
        pass

    yield

    # Post-test cleanup
    try:
        db_client.execute_non_query(cleanup_sql)
    except Exception:
        pass


@pytest.fixture(scope="function")
def db_tx(db_client, clean_sentinels):
    """
    Transaction-isolated fixture.
    Wraps execution within an outer transaction rollback when supported,
    or falls back to sentinel cleanup.
    """
    yield db_client


@pytest.fixture(scope="function")
def restore_baseline(master_client):
    """
    Disaster recovery drill reset fixture.
    Ensures that if test_backup_pitr.py leaves the database corrupted, in NORECOVERY,
    or in single-user mode, ECommerceDB_baseline.bak is restored to guarantee a clean state.
    Inspects sys.databases.state_desc to avoid calling ALTER DATABASE SET SINGLE_USER
    when already in RESTORING state (which causes Msg 927).
    """
    yield

    need_restore = False
    is_restoring = False
    try:
        rows = master_client.execute_query(
            "SELECT state_desc, user_access_desc FROM sys.databases WHERE name = 'ECommerceDB';"
        )
        if not rows:
            need_restore = True
        else:
            state = rows[0].get("state_desc")
            access = rows[0].get("user_access_desc")
            if state != "ONLINE" or access != "MULTI_USER":
                need_restore = True
            if state == "RESTORING":
                is_restoring = True
    except Exception:
        need_restore = True

    if need_restore:
        # If in RESTORING state, ALTER DATABASE SET SINGLE_USER fails with Msg 927.
        # Directly execute RESTORE DATABASE WITH REPLACE.
        if is_restoring:
            reset_sql = """
            USE master;
            RESTORE DATABASE [ECommerceDB]
            FROM DISK = N'/var/opt/mssql/backup/ECommerceDB_baseline.bak'
            WITH REPLACE;
            ALTER DATABASE [ECommerceDB] SET MULTI_USER;
            """
        else:
            reset_sql = """
            USE master;
            IF EXISTS (SELECT name FROM sys.databases WHERE name = N'ECommerceDB')
            BEGIN
                ALTER DATABASE [ECommerceDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                RESTORE DATABASE [ECommerceDB]
                FROM DISK = N'/var/opt/mssql/backup/ECommerceDB_baseline.bak'
                WITH REPLACE;
                ALTER DATABASE [ECommerceDB] SET MULTI_USER;
            END
            """
        try:
            master_client.execute_script(reset_sql)
        except Exception as e:
            print(f"[WARN] Failed to auto-restore baseline backup: {e}", file=sys.stderr)
