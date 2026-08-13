import os
import shutil
from typing import Protocol

class StorageBackend(Protocol):
    async def save(self, file_obj, filename: str) -> str:
        """Saves a file and returns the storage path/URI"""
        ...
        
    async def load(self, path: str) -> bytes:
        """Loads a file from a storage path/URI"""
        ...
        
    def get_absolute_path(self, path: str) -> str:
        """Returns local absolute path if applicable (for Gemini file upload)"""
        ...

class LocalStorage:
    def __init__(self, base_dir: str = "storage"):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)
        
    async def save(self, file_obj, filename: str) -> str:
        file_path = os.path.join(self.base_dir, filename)
        # Note: in real async we'd use aiofiles, doing sync here for simplicity in protocol
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file_obj.file, buffer)
        return file_path
        
    async def load(self, path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    def get_absolute_path(self, path: str) -> str:
        return os.path.abspath(path)

# Dependency injection
storage: StorageBackend = LocalStorage()
