from fastapi import Request


def get_current_user(request: Request = None):
    """
    In the standalone single-user version of Fontis, authentication is implicit:
    The user is always authorized as full 'archivar' without needing passwords or JWT tokens.
    """
    return {
        "id": "local_archivar",
        "username": "Archivar",
        "role": "archivar",
        "is_admin": True,
        "archive_id": "local",
        "name": "Fontis Archiv"
    }
