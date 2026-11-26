"""Connection / CSV helpers for the student's local Neo4j Desktop instance.
No passwords are stored in this project. Neo4j DBMS 2026.10.1, Cypher 25.
"""
from pathlib import Path
from getpass import getpass
import csv
import os
from neo4j import GraphDatabase

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / 'results'
RESULTS.mkdir(exist_ok=True)
DB_NAME = os.getenv('NEO4J_DATABASE', 'neo4j')
BOLT_URI = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
USERNAME = os.getenv('NEO4J_USER', 'neo4j')

def open_driver():
    password = os.getenv('NEO4J_PASSWORD') or getpass('Nhap mat khau Neo4j (an): ')
    driver = GraphDatabase.driver(BOLT_URI, auth=(USERNAME, password))
    driver.verify_connectivity()
    return driver

def one(session, query, **params):
    record = session.run(query, **params).single(strict=True)
    return record

def save_csv(filename, headers, rows):
    with (RESULTS / filename).open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader();w.writerows(rows)
