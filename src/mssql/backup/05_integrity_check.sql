-- ==============================================================================
-- 05_integrity_check.sql: Database Integrity Verification (DBCC CHECKDB)
-- Topic 5: Data Backup & Disaster Recovery (SQL Server 2022)
-- ==============================================================================
USE [master];
GO

DBCC CHECKDB ([ECommerceDB]) WITH NO_INFOMSGS, ALL_ERRORMSGS;
GO
