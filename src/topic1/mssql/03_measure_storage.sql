-- ==============================================================================
-- 03_measure_storage.sql: Physical & Allocation Unit Storage Metrics (SQL Server 2025)
-- Queries sys.partitions, sys.allocation_units, and sys.dm_db_index_physical_stats
-- ==============================================================================

USE [Topic1_StorageLab];
GO

SET NOCOUNT ON;

-- 1. Detailed Per-Table & Allocation Unit Breakdown (1 page = 8 KB = 8192 bytes)
SELECT
    t.name AS table_name,
    MAX(CASE WHEN i.index_id IN (0, 1) THEN p.rows ELSE 0 END) AS row_count,
    SUM(au.total_pages) AS total_pages,
    SUM(au.used_pages) AS used_pages,
    SUM(CASE WHEN au.type = 1 THEN au.used_pages ELSE 0 END) AS in_row_pages,
    SUM(CASE WHEN au.type = 3 THEN au.used_pages ELSE 0 END) AS row_overflow_pages,
    SUM(CASE WHEN au.type = 2 THEN au.used_pages ELSE 0 END) AS lob_pages,
    SUM(CASE WHEN i.index_id IN (0, 1) THEN au.used_pages ELSE 0 END) AS data_pages,
    SUM(CASE WHEN i.index_id > 1 THEN au.used_pages ELSE 0 END) AS index_pages,
    CAST(SUM(au.used_pages) * 8.0 / 1024.0 AS DECIMAL(10, 4)) AS used_mb,
    CAST(SUM(au.total_pages) * 8.0 / 1024.0 AS DECIMAL(10, 4)) AS reserved_mb
FROM sys.tables t
JOIN sys.indexes i ON t.object_id = i.object_id
JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
JOIN sys.allocation_units au ON p.partition_id = au.container_id
WHERE t.name LIKE 'T1_%'
GROUP BY t.name
ORDER BY used_mb DESC;

-- 2. Aggregated Per-Model Summary (50,000 variants baseline)
;WITH TableSpace AS (
    SELECT
        t.name AS table_name,
        MAX(CASE WHEN i.index_id IN (0, 1) THEN p.rows ELSE 0 END) AS row_count,
        SUM(au.total_pages) AS total_pages,
        SUM(au.used_pages) AS used_pages,
        SUM(CASE WHEN au.type = 1 THEN au.used_pages ELSE 0 END) AS in_row_pages,
        SUM(CASE WHEN au.type = 3 THEN au.used_pages ELSE 0 END) AS row_overflow_pages,
        SUM(CASE WHEN au.type = 2 THEN au.used_pages ELSE 0 END) AS lob_pages,
        SUM(CASE WHEN i.index_id IN (0, 1) THEN au.used_pages ELSE 0 END) AS data_pages,
        SUM(CASE WHEN i.index_id > 1 THEN au.used_pages ELSE 0 END) AS index_pages
    FROM sys.tables t
    JOIN sys.indexes i ON t.object_id = i.object_id
    JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
    JOIN sys.allocation_units au ON p.partition_id = au.container_id
    WHERE t.name LIKE 'T1_%'
    GROUP BY t.name
),
PhysStats AS (
    SELECT
        OBJECT_NAME(ips.object_id) AS table_name,
        CAST(AVG(ips.avg_record_size_in_bytes) AS DECIMAL(10, 2)) AS avg_record_size_bytes,
        CAST(MAX(ips.avg_fragmentation_in_percent) AS DECIMAL(10, 2)) AS avg_frag_pct
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'SAMPLED') ips
    WHERE OBJECT_NAME(ips.object_id) LIKE 'T1_%'
      AND ips.index_id IN (0, 1)
      AND ips.alloc_unit_type_desc = 'IN_ROW_DATA'
    GROUP BY OBJECT_NAME(ips.object_id)
),
ModelMap AS (
    SELECT 'M1_EAV' AS model_key, 'T1_Attributes' AS table_name UNION ALL
    SELECT 'M1_EAV', 'T1_Variants_EAV' UNION ALL
    SELECT 'M1_EAV', 'T1_Variant_Attr_Values' UNION ALL
    SELECT 'M1_EAV_PageComp', 'T1_Attributes' UNION ALL
    SELECT 'M1_EAV_PageComp', 'T1_Variants_EAV' UNION ALL
    SELECT 'M1_EAV_PageComp', 'T1_Variant_Attr_Values_PageComp' UNION ALL
    SELECT 'M2a_JsonText', 'T1_Variants_JsonText' UNION ALL
    SELECT 'M2b_JsonNative', 'T1_Variants_JsonNative' UNION ALL
    SELECT 'M3_Sparse', 'T1_Variants_Sparse' UNION ALL
    SELECT 'Control_WideNoSparse', 'T1_Variants_WideNoSparse'
)
SELECT
    mm.model_key,
    50000 AS variant_count,
    MAX(ts.row_count) AS main_row_count,
    SUM(ts.total_pages) AS total_pages,
    SUM(ts.used_pages) AS used_pages,
    CAST(SUM(ts.data_pages) * 8.0 / 1024.0 AS DECIMAL(10, 4)) AS data_mb,
    CAST(SUM(ts.index_pages) * 8.0 / 1024.0 AS DECIMAL(10, 4)) AS index_mb,
    CAST(SUM(ts.used_pages) * 8.0 / 1024.0 AS DECIMAL(10, 4)) AS total_mb,
    CAST((SUM(ts.used_pages) * 8192.0) / 50000.0 AS DECIMAL(10, 2)) AS bytes_per_variant,
    SUM(ts.in_row_pages) AS in_row_pages,
    SUM(ts.row_overflow_pages) AS row_overflow_pages,
    SUM(ts.lob_pages) AS lob_pages,
    MAX(CASE WHEN ts.table_name NOT IN ('T1_Attributes') THEN ps.avg_record_size_bytes ELSE NULL END) AS avg_record_size_bytes,
    MAX(ps.avg_frag_pct) AS avg_fragmentation_pct
FROM ModelMap mm
JOIN TableSpace ts ON ts.table_name = mm.table_name
LEFT JOIN PhysStats ps ON ps.table_name = mm.table_name
GROUP BY mm.model_key
ORDER BY total_mb ASC;
GO
