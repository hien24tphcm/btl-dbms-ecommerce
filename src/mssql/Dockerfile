# Custom Microsoft SQL Server 2022 Dockerfile for Multi-Vendor E-Commerce DBMS
FROM mcr.microsoft.com/mssql/server:2022-latest

# Switch to root to create directories and adjust filesystem permissions
USER root

# Create backup and init directories; assign ownership to mssql user and root group
RUN mkdir -p /var/opt/mssql/backup /init \
    && chown -R mssql:root /var/opt/mssql/backup /init \
    && chmod -R 775 /var/opt/mssql/backup /init

# Copy database initialization SQL scripts into the container
COPY init/ /init/

# Restore default non-root mssql container user
USER mssql

# Expose standard TDS port for MSSQL Server
EXPOSE 1433

# Declare persistent volumes
VOLUME ["/var/opt/mssql/data", "/var/opt/mssql/backup"]
