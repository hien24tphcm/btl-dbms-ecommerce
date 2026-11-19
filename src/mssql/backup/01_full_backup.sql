-- ==============================================================================
-- 01_full_backup.sql: Full Database Backup with Compression and Checksum
-- Topic 5: Data Backup & Disaster Recovery (SQL Server 2022)
-- ==============================================================================
USE [master];
GO

BACKUP DATABASE [ECommerceDB]
TO DISK = N'/var/opt/mssql/backup/ECommerceDB_Full.bak'
WITH
    FORMAT,
    INIT,
    COMPRESSION,
    CHECKSUM,
    NAME = N'ECommerceDB-Full Database Backup',
    STATS = 10;
GO
