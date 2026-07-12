# Agent Rules

## Python Async Testing (Neo4j)
When testing Python applications in this codebase that use asynchronous context managers (like Neo4j async sessions in `async with` blocks), you must mock them by explicitly configuring the `__aenter__` and `__aexit__` methods.
Standard `AsyncMock` instances cannot be used directly as async context managers. 

**Example:**
```python
session_cm = AsyncMock()
session_cm.__aenter__.return_value = mock_session
session_cm.__aexit__.return_value = False
mock_driver.session.return_value = session_cm
```

## Phone Number Limits
When creating or modifying phone number input fields in the UI, always enforce a reasonable character limit (e.g., using `maxLength={15}`) to prevent excessively long entries and protect the layout/database.
