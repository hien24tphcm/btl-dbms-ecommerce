-- ==============================================================================
-- 02_diff_backup.sql: Differential Database Backup with Compression and Checksum
-- Topic 5: Data Backup & Disaster Recovery (SQL Server 2022)
-- Prerequisite: At least one Full Database Backup must already exist.
-- ==============================================================================
USE [master];
GO

BACKUP DATABASE [ECommerceDB]
TO DISK = N'/var/opt/mssql/backup/ECommerceDB_Diff.bak'
WITH
    DIFFERENTIAL,
    INIT,
    COMPRESSION,
    CHECKSUM,
    NAME = N'ECommerceDB-Differential Database Backup',
    STATS = 10;
GO
