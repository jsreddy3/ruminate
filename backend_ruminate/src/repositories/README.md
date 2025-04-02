
### For JEN
To implement a new storage backend:

1. Create a new implementation in `repositories/implementations/`
2. Implement either `DocumentRepository` or `StorageRepository` interface
3. Add configuration in `config.py`
4. Update `factory.py` to support the new implementation

### Implementing New Storage Backends

This guide walks through the exact steps needed to add a new storage implementation (e.g., PostgreSQL, MongoDB, etc.).

### Step 1: Add Storage Type
1. Open `src/repositories/factory.py`
2. Add your storage type to the `StorageType` enum:
```python
class StorageType(Enum):
    LOCAL = "local"
    SQLITE = "sqlite"
    YOUR_TYPE = "your_type"  # Add this
```

### Step 2: Add Configuration
1. Open `src/config.py`
2. Add your configuration fields to the `Settings` class:
```python
class Settings(BaseSettings):
    # Your new settings
    your_host: Optional[str] = None
    your_port: Optional[int] = None
    your_password: Optional[str] = None
```
3. Add validation in the `validate_storage_types` method:
```python
def validate_storage_types(self):
    if self.document_storage_type == "your_type":
        if not all([self.your_host, self.your_port]):
            raise ValueError("Required settings missing")
```

### Step 3: Create Repository Implementation
1. Create a new file in `src/repositories/implementations/`
2. Implement either:
   - `DocumentRepository` for document storage
   - `StorageRepository` for file storage
3. Required methods are defined in the interface classes in `src/repositories/interfaces/`

### Step 4: Update Factory
1. Open `src/repositories/factory.py`
2. Add your implementation to `init_repositories`:
```python
def init_repositories(self, document_type: str, **kwargs):
    elif document_type == "your_type":
        from .implementations.your_repository import YourRepository
        self._document_repo = YourRepository(
            host=kwargs.get('your_host'),
            port=kwargs.get('your_port')
        )
```

### Step 5: Add Tests
1. Add your implementation to `tests/test_repositories.py`
2. Test all interface methods
3. Add cleanup code to remove test data

### Step 6: Update Environment
1. Add required variables to `.env`:
```bash
DOCUMENT_STORAGE_TYPE=your_type
YOUR_HOST=localhost
YOUR_PORT=5432
```

### Step 7: Update Documentation
1. Add your implementation to the README
2. Document required environment variables
3. Add any special setup instructions

### Example: Using SQLite Implementation
To use SQLite storage:

1. Install dependencies:
```bash
pip install aiosqlite
```

2. Update `.env`:
```bash
DOCUMENT_STORAGE_TYPE=sqlite
DB_PATH=sqlite.db  # Optional, defaults to sqlite.db
```

3. Run the server:
```bash
python -m src.main
```

4. Verify installation:
```bash
# Check tables
sqlite3 sqlite.db ".tables"

# View documents
sqlite3 sqlite.db "SELECT * FROM documents;"
```

### Troubleshooting New Implementations

1. **Configuration Issues**
   - Check `.env` file has all required variables
   - Verify `config.py` validation is working
   - Run with debug logging enabled

2. **Database Issues**
   - Verify connection strings
   - Check database permissions
   - Ensure schema is created properly

3. **Integration Issues**
   - Run repository tests
   - Check factory initialization
   - Verify interface compliance

4. **Common Gotchas**
   - Remember to handle async/await correctly
   - Implement proper connection pooling
   - Add proper error handling
   - Clean up resources in tests

### Testing
Run the test upload script:
```bash
python tests/test_upload.py
```

This will:
1. Upload a test PDF
2. Process it through Marker
3. Store results in local storage 
