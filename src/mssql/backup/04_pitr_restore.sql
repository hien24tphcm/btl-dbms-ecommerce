-- ==============================================================================
-- 04_pitr_restore.sql: Point-In-Time Recovery (PITR) via LSN Chain + STOPAT
-- Topic 5: Data Backup & Disaster Recovery (SQL Server 2022)
-- Usage via sqlcmd:
--   sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C \
--     -v STOPAT_TIME="2026-11-15T12:00:00" -i 04_pitr_restore.sql
-- ==============================================================================
USE [master];
GO

-- Step 1: Isolate database & capture Tail-Log (NORECOVERY -> RESTORING state)
IF EXISTS (SELECT 1 FROM sys.databases WHERE name = N'ECommerceDB' AND state_desc = N'ONLINE')
BEGIN
    ALTER DATABASE [ECommerceDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    BACKUP LOG [ECommerceDB]
    TO DISK = N'/var/opt/mssql/backup/ECommerceDB_TailLog.trn'
    WITH NORECOVERY, FORMAT, INIT, COMPRESSION, CHECKSUM;
END
GO

-- Step 2: Restore Full Baseline Backup with NORECOVERY
RESTORE DATABASE [ECommerceDB]
FROM DISK = N'/var/opt/mssql/backup/ECommerceDB_Full.bak'
WITH NORECOVERY, REPLACE, STATS = 10;
GO

-- Step 3: Replay Tail-Log up to exact STOPAT timestamp and bring DB ONLINE
RESTORE LOG [ECommerceDB]
FROM DISK = N'/var/opt/mssql/backup/ECommerceDB_TailLog.trn'
WITH RECOVERY, STOPAT = '$(STOPAT_TIME)', STATS = 10;
GO

-- Step 4: Restore MULTI_USER access mode
ALTER DATABASE [ECommerceDB] SET MULTI_USER;
GO
