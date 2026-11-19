-- ==============================================================================
-- 03_log_backup.sql: Transaction Log & Tail-Log Backup Scripts
-- Topic 5: Data Backup & Disaster Recovery (SQL Server 2022)
-- ==============================================================================
USE [master];
GO

-- Standard Online Transaction Log Backup (truncates inactive VLFs)
BACKUP LOG [ECommerceDB]
TO DISK = N'/var/opt/mssql/backup/ECommerceDB_Log.trn'
WITH
    INIT,
    COMPRESSION,
    CHECKSUM,
    NAME = N'ECommerceDB-Transaction Log Backup',
    STATS = 10;
GO

-- For Tail-Log Backup prior to Point-in-Time Recovery (puts DB in RESTORING):
-- ALTER DATABASE [ECommerceDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
-- BACKUP LOG [ECommerceDB]
-- TO DISK = N'/var/opt/mssql/backup/ECommerceDB_TailLog.trn'
-- WITH NORECOVERY, FORMAT, INIT, COMPRESSION, CHECKSUM;
