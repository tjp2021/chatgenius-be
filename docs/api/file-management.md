# File Management API Documentation

## Overview
The File Management API provides endpoints for uploading, retrieving, searching, and deleting files. All files are stored in AWS S3 with user-specific paths and accessed via pre-signed URLs.

## Base URL
```
/files
```

## Authentication
All endpoints require authentication using a Bearer token.
```http
Authorization: Bearer <your_token>
```

## Endpoints

### 1. Upload File
Upload a new file to the system.

```http
POST /files/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

#### Request Body
| Field | Type   | Required | Description |
|-------|--------|----------|-------------|
| file  | Binary | Yes      | File to upload |

#### Constraints
- Maximum file size: 5MB
- Allowed file types: 
  - image/jpeg
  - image/png
  - application/pdf
- Files are stored in AWS S3 with user-specific paths
- Returns a pre-signed URL valid for 1 hour

#### Success Response
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "document.pdf",
  "url": "https://s3.amazonaws.com/bucket/user-id/uuid-document.pdf"
}
```
**Status:** 201 Created

#### Error Responses

##### Invalid File
```json
{
  "statusCode": 400,
  "message": "Invalid file type. Allowed types: image/jpeg, image/png, application/pdf",
  "error": "Bad Request"
}
```
**Status:** 400 Bad Request

##### No File Uploaded
```json
{
  "statusCode": 400,
  "message": "No file uploaded",
  "error": "Bad Request"
}
```
**Status:** 400 Bad Request

##### Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Status:** 401 Unauthorized

---

### 2. Get File Details
Retrieve file metadata and generate a pre-signed download URL.

```http
GET /files/:id
Authorization: Bearer <token>
```

#### Parameters
| Name | Type   | In   | Required | Description |
|------|--------|------|----------|-------------|
| id   | string | path | Yes      | File UUID   |

#### Success Response
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "document.pdf",
  "type": "application/pdf",
  "size": 1048576,
  "url": "https://s3.amazonaws.com/bucket/user-id/uuid-document.pdf",
  "userId": "user-123",
  "createdAt": "2024-01-12T12:00:00Z",
  "updatedAt": "2024-01-12T12:00:00Z"
}
```
**Status:** 200 OK

#### Error Responses

##### File Not Found
```json
{
  "statusCode": 404,
  "message": "File not found",
  "error": "Not Found"
}
```
**Status:** 404 Not Found

##### Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Status:** 401 Unauthorized

---

### 3. Search Files
Search and filter files with pagination support.

```http
GET /files
Authorization: Bearer <token>
```

#### Query Parameters
| Name     | Type   | Required | Description | Default |
|----------|--------|----------|-------------|---------|
| filename | string | No       | Filter by filename (partial match) | - |
| type     | string | No       | Filter by file type (exact match) | - |
| skip     | number | No       | Number of records to skip | 0 |
| take     | number | No       | Number of records to return | 10 |

#### Notes
- Results are ordered by creation date (newest first)
- Maximum page size (take) is 100
- Pre-signed URLs are generated for each file in results
- URLs are valid for 1 hour

#### Success Response
```json
{
  "items": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "name": "document.pdf",
      "type": "application/pdf",
      "size": 1048576,
      "url": "https://s3.amazonaws.com/bucket/user-id/uuid-document.pdf",
      "userId": "user-123",
      "createdAt": "2024-01-12T12:00:00Z",
      "updatedAt": "2024-01-12T12:00:00Z"
    }
  ],
  "total": 1
}
```
**Status:** 200 OK

#### Error Response

##### Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Status:** 401 Unauthorized

---

### 4. Delete File
Permanently delete a file from both S3 storage and database.

```http
DELETE /files/:id
Authorization: Bearer <token>
```

#### Parameters
| Name | Type   | In   | Required | Description |
|------|--------|------|----------|-------------|
| id   | string | path | Yes      | File UUID   |

#### Notes
- This operation cannot be undone
- Both S3 object and database record are deleted
- Operation is idempotent (returns success even if file doesn't exist)

#### Success Response
```json
{
  "message": "File deleted successfully"
}
```
**Status:** 200 OK

#### Error Responses

##### File Not Found
```json
{
  "statusCode": 404,
  "message": "File not found",
  "error": "Not Found"
}
```
**Status:** 404 Not Found

##### Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Status:** 401 Unauthorized

## Security Considerations

### Authentication
- All endpoints require a valid Bearer token
- Token must be included in the Authorization header
- Invalid or expired tokens result in 401 Unauthorized response

### File Storage
- Files are stored in user-specific paths in S3
- Access is controlled via pre-signed URLs
- URLs expire after 1 hour
- Original file names are preserved but prefixed with UUID

### Upload Restrictions
- Maximum file size: 5MB
- Only allowed file types:
  - image/jpeg
  - image/png
  - application/pdf
- File type validation is performed on both extension and MIME type

### Rate Limiting
- Upload endpoint is rate-limited
- Search endpoint uses pagination to prevent large data dumps

## Error Handling
All error responses follow the same format:
```json
{
  "statusCode": <number>,
  "message": <string>,
  "error": <string>
}
```

Common error codes:
- 400: Bad Request (invalid input)
- 401: Unauthorized (missing or invalid token)
- 404: Not Found (resource doesn't exist)
- 413: Payload Too Large (file size exceeds limit)
- 415: Unsupported Media Type (invalid file type)
- 429: Too Many Requests (rate limit exceeded)
- 500: Internal Server Error (server-side error)

## Best Practices
1. Always check file size before upload
2. Handle URL expiration by requesting new URLs when needed
3. Use pagination for large result sets
4. Implement retry logic for failed uploads
5. Cache file metadata when appropriate
6. Clean up unused files periodically 