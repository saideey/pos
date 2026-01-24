"""
Database connection and session management.
"""

import os
from contextlib import contextmanager
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

from .base import Base


class DatabaseConnection:
    """Database connection manager."""
    
    _instance = None
    _engine = None
    _session_factory = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._engine is None:
            self._initialize()
    
    def _initialize(self):
        """Initialize database connection."""
        database_url = os.getenv(
            'DATABASE_URL',
            'postgresql://postgres:postgres@db:5432/metall_basa'
        )
        
        # Connection pool settings optimized for long-running server
        self._engine = create_engine(
            database_url,
            poolclass=QueuePool,
            pool_size=5,              # Reduced from 10
            max_overflow=10,          # Reduced from 20
            pool_pre_ping=True,       # Check connection before using
            pool_recycle=300,         # Recycle connections every 5 minutes (was 1 hour)
            pool_timeout=30,          # Wait max 30 seconds for connection
            connect_args={
                "connect_timeout": 10,           # Connection timeout
                "keepalives": 1,                 # Enable TCP keepalives
                "keepalives_idle": 30,           # Start keepalive after 30s idle
                "keepalives_interval": 10,       # Send keepalive every 10s
                "keepalives_count": 5,           # Max 5 failed keepalives
            },
            echo=os.getenv('SQL_ECHO', 'false').lower() == 'true'
        )
        
        self._session_factory = sessionmaker(
            bind=self._engine,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False
        )
        
        # Register event listeners
        self._register_events()
    
    def _register_events(self):
        """Register SQLAlchemy event listeners."""
        @event.listens_for(self._engine, "connect")
        def set_search_path(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("SET search_path TO public")
            cursor.close()
        
        @event.listens_for(self._engine, "checkout")
        def check_connection(dbapi_conn, connection_record, connection_proxy):
            """Validate connection on checkout from pool."""
            try:
                cursor = dbapi_conn.cursor()
                cursor.execute("SELECT 1")
                cursor.close()
            except Exception:
                # Connection is invalid, raise to trigger reconnection
                raise Exception("Connection validation failed")
    
    @property
    def engine(self):
        """Get database engine."""
        return self._engine
    
    @property
    def session_factory(self):
        """Get session factory."""
        return self._session_factory
    
    def create_all_tables(self):
        """Create all tables in the database."""
        # Import all models to register them
        from .models import (
            user, product, warehouse, sale, 
            customer, supplier, finance, settings
        )
        Base.metadata.create_all(self._engine)
    
    def drop_all_tables(self):
        """Drop all tables in the database."""
        Base.metadata.drop_all(self._engine)
    
    @contextmanager
    def get_session(self) -> Session:
        """Get database session with automatic commit/rollback."""
        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def get_session_direct(self) -> Session:
        """Get database session without context manager."""
        return self._session_factory()
    
    def dispose_engine(self):
        """Dispose all pooled connections."""
        if self._engine:
            self._engine.dispose()


# Singleton instance
db = DatabaseConnection()


def get_db() -> Session:
    """Dependency for FastAPI to get database session."""
    session = db.get_session_direct()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db():
    """Initialize database and create all tables."""
    db.create_all_tables()
    print("✅ Database tables created successfully!")


def reset_db():
    """Reset database - drop and recreate all tables."""
    db.drop_all_tables()
    db.create_all_tables()
    print("✅ Database reset successfully!")
