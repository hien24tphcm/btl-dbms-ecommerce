import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as sql from 'mssql';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface SqlParamDef {
  type?: any;
  value: any;
  sqlTypeName?: string;
}

export interface SqlExecResult<T = any> {
  recordsets: T[][];
  recordset: T[];
  output: Record<string, any>;
}

@Injectable()
export class MssqlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MssqlService.name);
  private pool: sql.ConnectionPool | null = null;
  private useWindowsLocalBridge = false;

  private getSqlConfig(): sql.config {
    return {
      user: process.env.DB_USER || process.env.MSSQL_USER || 'sa',
      password:
        process.env.DB_PASSWORD ||
        process.env.MSSQL_SA_PASSWORD ||
        'Password_123#',
      database: process.env.DB_NAME || 'ECommerceDB',
      server: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || process.env.MSSQL_PORT || 1433),
      pool: {
        max: 20,
        min: 2,
        idleTimeoutMillis: 30000,
      },
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
      connectionTimeout: 3500,
      requestTimeout: 30000,
    };
  }

  async onModuleInit() {
    try {
      const cfg = this.getSqlConfig();
      this.pool = await new sql.ConnectionPool(cfg).connect();
      this.useWindowsLocalBridge = false;
      this.logger.log(
        `Connected to MS SQL Server (${cfg.server}:${cfg.port}/${cfg.database}) via mssql ConnectionPool.`,
      );
    } catch (err: any) {
      this.pool = null;
      if (process.platform === 'win32') {
        this.useWindowsLocalBridge = true;
        this.logger.warn(
          `TCP 1433 unavailable (${err?.message || 'Docker offline'}). Using local Windows MSSQLSERVER [ECommerceDB] Integrated Security bridge.`,
        );
      } else {
        this.logger.error('Failed to connect to MS SQL Server:', err);
      }
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  async getPool(): Promise<sql.ConnectionPool | null> {
    if (this.pool && this.pool.connected) {
      return this.pool;
    }
    if (!this.useWindowsLocalBridge) {
      try {
        this.pool = await new sql.ConnectionPool(this.getSqlConfig()).connect();
        return this.pool;
      } catch {
        if (process.platform === 'win32') {
          this.useWindowsLocalBridge = true;
        }
      }
    }
    return null;
  }

  /**
   * Executes a parameterized T-SQL query against ECommerceDB.
   */
  async query<T = any>(
    sqlText: string,
    params: Record<string, SqlParamDef | any> = {},
  ): Promise<SqlExecResult<T>> {
    const pool = await this.getPool();
    if (pool) {
      const req = pool.request();
      for (const [key, rawDef] of Object.entries(params)) {
        const isParamObj =
          rawDef !== null &&
          typeof rawDef === 'object' &&
          'value' in rawDef;
        const val = isParamObj ? rawDef.value : rawDef;
        const type = isParamObj ? rawDef.type : undefined;
        if (type) {
          req.input(key, type, val);
        } else {
          req.input(key, val);
        }
      }
      const res = await req.query<T>(sqlText);
      return {
        recordsets: (res.recordsets as T[][]) || [],
        recordset: (res.recordset as T[]) || [],
        output: res.output || {},
      };
    }

    return this.runViaWindowsSqlClient<T>({
      mode: 'Text',
      commandText: sqlText,
      inputs: this.normalizeParams(params),
      outputs: {},
    });
  }

  /**
   * Executes one of the 16 Stored Procedures in ECommerceDB (04_procedures_fr.sql)
   * with full support for multiple Result Sets and OUTPUT parameters.
   */
  async executeProcedure<T = any>(
    procName: string,
    inputs: Record<string, SqlParamDef | any> = {},
    outputs: Record<string, { type?: any; sqlTypeName?: string; value?: any }> = {},
  ): Promise<SqlExecResult<T>> {
    const pool = await this.getPool();
    if (pool) {
      const req = pool.request();
      for (const [key, rawDef] of Object.entries(inputs)) {
        const isParamObj =
          rawDef !== null &&
          typeof rawDef === 'object' &&
          'value' in rawDef;
        const val = isParamObj ? rawDef.value : rawDef;
        const type = isParamObj ? rawDef.type : undefined;
        if (type) {
          req.input(key, type, val);
        } else {
          req.input(key, val);
        }
      }
      for (const [key, outDef] of Object.entries(outputs)) {
        req.output(key, outDef.type || sql.Int, outDef.value);
      }
      const res = await req.execute<T>(procName);
      return {
        recordsets: (res.recordsets as T[][]) || [],
        recordset: (res.recordset as T[]) || [],
        output: res.output || {},
      };
    }

    return this.runViaWindowsSqlClient<T>({
      mode: 'StoredProcedure',
      commandText: procName,
      inputs: this.normalizeParams(inputs),
      outputs: this.normalizeOutputs(outputs),
    });
  }

  private normalizeParams(
    params: Record<string, SqlParamDef | any>,
  ): Record<string, { value: any; sqlTypeName?: string }> {
    const out: Record<string, { value: any; sqlTypeName?: string }> = {};
    for (const [k, raw] of Object.entries(params)) {
      if (raw !== null && typeof raw === 'object' && 'value' in raw) {
        out[k] = {
          value: raw.value,
          sqlTypeName: raw.sqlTypeName,
        };
      } else {
        out[k] = { value: raw };
      }
    }
    return out;
  }

  private normalizeOutputs(
    outputs: Record<string, { type?: any; sqlTypeName?: string; value?: any }>,
  ): Record<string, { sqlTypeName: string; value?: any }> {
    const out: Record<string, { sqlTypeName: string; value?: any }> = {};
    for (const [k, def] of Object.entries(outputs)) {
      out[k] = {
        sqlTypeName: def.sqlTypeName || 'Int',
        value: def.value ?? null,
      };
    }
    return out;
  }

  /**
   * Local Windows SQL Server Shared-Memory execution via System.Data.SqlClient
   * Used automatically when Docker TCP 1433 is offline and local Windows MSSQLSERVER is active.
   */
  private async runViaWindowsSqlClient<T = any>(payload: {
    mode: 'Text' | 'StoredProcedure';
    commandText: string;
    inputs: Record<string, { value: any; sqlTypeName?: string }>;
    outputs: Record<string, { sqlTypeName: string; value?: any }>;
  }): Promise<SqlExecResult<T>> {
    const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64',
    );
    const dbName = process.env.DB_NAME || 'ECommerceDB';
    const psScript = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$json = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${payloadB64}'))
$req = ConvertFrom-Json $json
$conn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Database=${dbName};Integrated Security=True;TrustServerCertificate=True;")
try {
  $conn.Open()
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = $req.commandText
  if ($req.mode -eq 'StoredProcedure') {
    $cmd.CommandType = [System.Data.CommandType]::StoredProcedure
  } else {
    $cmd.CommandType = [System.Data.CommandType]::Text
  }
  if ($req.inputs) {
    foreach ($prop in $req.inputs.PSObject.Properties) {
      $val = $prop.Value.value
      if ($null -eq $val) {
        [void]$cmd.Parameters.AddWithValue('@' + $prop.Name, [System.DBNull]::Value)
      } else {
        [void]$cmd.Parameters.AddWithValue('@' + $prop.Name, $val)
      }
    }
  }
  $outParams = @{}
  if ($req.outputs) {
    foreach ($prop in $req.outputs.PSObject.Properties) {
      $p = New-Object System.Data.SqlClient.SqlParameter('@' + $prop.Name, [System.Data.SqlDbType]::Int)
      $p.Direction = [System.Data.ParameterDirection]::InputOutput
      if ($null -eq $prop.Value.value) {
        $p.Value = [System.DBNull]::Value
      } else {
        $p.Value = [int]$prop.Value.value
      }
      [void]$cmd.Parameters.Add($p)
      $outParams[$prop.Name] = $p
    }
  }
  $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
  $ds = New-Object System.Data.DataSet
  [void]$adapter.Fill($ds)
  $recordsets = @()
  foreach ($table in $ds.Tables) {
    $rows = @()
    foreach ($row in $table.Rows) {
      $obj = [ordered]@{}
      foreach ($col in $table.Columns) {
        $v = $row[$col]
        if ($v -is [System.DBNull]) { $obj[$col.ColumnName] = $null }
        elseif ($v -is [DateTime]) { $obj[$col.ColumnName] = $v.ToString('o') }
        else { $obj[$col.ColumnName] = $v }
      }
      $rows += [pscustomobject]$obj
    }
    $recordsets += ,$rows
  }
  $outValues = [ordered]@{}
  foreach ($k in $outParams.Keys) {
    $v = $outParams[$k].Value
    if ($v -is [System.DBNull]) { $outValues[$k] = $null } else { $outValues[$k] = $v }
  }
  $res = [ordered]@{ ok = $true; recordsets = $recordsets; output = $outValues }
  Write-Output ($res | ConvertTo-Json -Depth 10 -Compress)
} catch {
  $ex = $_.Exception
  while ($ex.InnerException) { $ex = $ex.InnerException }
  $num = 50000
  if ($ex -is [System.Data.SqlClient.SqlException]) { $num = $ex.Number }
  $errObj = [ordered]@{ ok = $false; number = $num; message = $ex.Message }
  Write-Output ($errObj | ConvertTo-Json -Compress)
} finally {
  if ($conn.State -eq 'Open') { $conn.Close() }
}
`;

    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { maxBuffer: 10 * 1024 * 1024 },
    );

    const parsed = JSON.parse(stdout.trim());
    if (!parsed.ok) {
      const error: any = new Error(parsed.message || 'SQL execution error');
      error.number = parsed.number;
      throw error;
    }

    const recordsets: T[][] = parsed.recordsets || [];
    return {
      recordsets,
      recordset: recordsets[0] || [],
      output: parsed.output || {},
    };
  }
}
