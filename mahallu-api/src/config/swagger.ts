import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Mahallu Management System API',
    version: '1.0.0',
    description: `
# Mahallu Management System API Documentation

## Overview
This API provides endpoints for managing mahallu (community) data including families, members, institutes, programs, committees, meetings, registrations, collectibles, and more.

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## User Roles

### 1. Super Admin
- Full access to all tenants and data
- Can manage tenants, users, and all resources across all tenants
- Phone: 9999999999 (default)

### 2. Mahall Admin (mahall)
- Manages data for their assigned tenant
- Can manage users, families, members, and most resources
- Access to master accounts and user management

### 3. Institute User (institute)
- Manages institute-related data for their tenant
- Access to master accounts (institute accounts, categories, wallets, ledgers)
- Limited access to other resources

### 4. Survey User (survey)
- Can view and manage survey-related data
- Limited access to other resources

### 5. Public User
- Unauthenticated access to public endpoints
- Limited to health check and authentication endpoints

## Base URL
\`\`\`
http://localhost:5000/api
\`\`\`

## Response Format
All responses follow this format:
\`\`\`json
{
  "success": true|false,
  "message": "Optional message",
  "data": {},
  "pagination": {} // For paginated responses
}
\`\`\`
    `,
    contact: {
      name: 'API Support',
      email: 'support@jamaahhub.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000/api',
      description: 'Development server',
    },
    {
      url: 'https://api.jamaahhub.com/api',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /auth/login or /auth/verify-otp',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Error message',
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: {
            type: 'number',
            example: 1,
          },
          limit: {
            type: 'number',
            example: 10,
          },
          total: {
            type: 'number',
            example: 100,
          },
          pages: {
            type: 'number',
            example: 10,
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
            description: 'MongoDB ObjectId',
          },
          name: {
            type: 'string',
            example: 'John Doe',
            minLength: 2,
            maxLength: 100,
          },
          phone: {
            type: 'string',
            example: '9876543210',
            pattern: '^[0-9]{10}$',
            description: '10-digit phone number',
          },
          email: {
            type: 'string',
            example: 'john@example.com',
            format: 'email',
            nullable: true,
          },
          role: {
            type: 'string',
            enum: ['super_admin', 'mahall', 'survey', 'institute'],
            example: 'mahall',
            description: 'User role',
          },
          tenantId: {
            type: 'string',
            nullable: true,
            example: '507f1f77bcf86cd799439012',
            description: 'Tenant ID (null for super admin)',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive'],
            example: 'active',
            description: 'User account status',
          },
          permissions: {
            type: 'object',
            properties: {
              view: { type: 'boolean', example: true, description: 'View permission' },
              add: { type: 'boolean', example: true, description: 'Add permission' },
              edit: { type: 'boolean', example: true, description: 'Edit permission' },
              delete: { type: 'boolean', example: false, description: 'Delete permission' },
            },
            description: 'User permissions object',
          },
          isSuperAdmin: {
            type: 'boolean',
            example: false,
            description: 'Whether user is super admin',
          },
          joiningDate: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T00:00:00.000Z',
          },
          lastLogin: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T00:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
          },
        },
        required: ['_id', 'name', 'phone', 'role', 'status', 'permissions', 'isSuperAdmin'],
      },
      CreateUserRequest: {
        type: 'object',
        required: ['name', 'phone', 'role'],
        properties: {
          name: {
            type: 'string',
            example: 'John Doe',
            minLength: 2,
            maxLength: 100,
            description: 'Full name of the user',
          },
          phone: {
            type: 'string',
            example: '9876543210',
            pattern: '^[0-9]{10}$',
            description: '10-digit phone number (must be unique per tenant)',
          },
          email: {
            type: 'string',
            example: 'john@example.com',
            format: 'email',
            description: 'Email address (optional)',
          },
          role: {
            type: 'string',
            enum: ['super_admin', 'mahall', 'survey', 'institute'],
            example: 'mahall',
            description: 'User role',
          },
          password: {
            type: 'string',
            example: 'password123',
            minLength: 6,
            description: 'Password (optional, defaults to 123456 if not provided)',
          },
          tenantId: {
            type: 'string',
            example: '507f1f77bcf86cd799439012',
            description: 'Tenant ID (required for non-super-admin users, Super Admin only can specify)',
          },
          permissions: {
            type: 'object',
            properties: {
              view: { type: 'boolean', example: true },
              add: { type: 'boolean', example: true },
              edit: { type: 'boolean', example: true },
              delete: { type: 'boolean', example: false },
            },
            description: 'User permissions (optional, defaults to all false)',
          },
        },
      },
      UpdateUserRequest: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            example: 'John Updated',
            minLength: 2,
            maxLength: 100,
            description: 'Updated name',
          },
          phone: {
            type: 'string',
            example: '9876543210',
            pattern: '^[0-9]{10}$',
            description: 'Updated phone number',
          },
          email: {
            type: 'string',
            example: 'john.updated@example.com',
            format: 'email',
            description: 'Updated email address',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive'],
            example: 'active',
            description: 'Updated status',
          },
        },
      },
      Family: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439013' },
          houseName: { type: 'string', example: 'Al-Hamd House', minLength: 1, maxLength: 200 },
          mahallId: { type: 'string', example: 'MAH001', description: 'Mahall identification number' },
          varisangyaGrade: {
            type: 'string',
            enum: ['Grade A', 'Grade B', 'Grade C', 'Grade D'],
            example: 'Grade A',
            description: 'Varisangya grade classification',
          },
          familyHead: { type: 'string', example: 'Ahmed Ali', description: 'Name of family head' },
          contactNo: { type: 'string', example: '9876543210', description: 'Contact phone number' },
          wardNumber: { type: 'string', example: 'Ward 5', description: 'Ward number' },
          houseNo: { type: 'string', example: 'H-123', description: 'House number' },
          area: {
            type: 'string',
            enum: ['Area A', 'Area B', 'Area C', 'Area D'],
            example: 'Area A',
            description: 'Area classification',
          },
          place: { type: 'string', example: 'Kozhikode', description: 'Place name' },
          via: { type: 'string', example: 'Via Calicut', description: 'Via location' },
          state: { type: 'string', example: 'Kerala', required: true },
          district: { type: 'string', example: 'Kozhikode', required: true },
          pinCode: { type: 'string', example: '673001', description: 'PIN code' },
          postOffice: { type: 'string', example: 'Kozhikode HO', description: 'Post office name' },
          lsgName: { type: 'string', example: 'Kozhikode Corporation', required: true },
          village: { type: 'string', example: 'Kozhikode', required: true },
          status: {
            type: 'string',
            enum: ['approved', 'unapproved', 'pending'],
            example: 'approved',
            default: 'pending',
          },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'houseName', 'state', 'district', 'lsgName', 'village'],
      },
      CreateFamilyRequest: {
        type: 'object',
        required: ['houseName', 'state', 'district', 'lsgName', 'village'],
        properties: {
          houseName: {
            type: 'string',
            example: 'Al-Hamd House',
            minLength: 1,
            maxLength: 200,
            description: 'Name of the house/family',
          },
          mahallId: {
            type: 'string',
            example: 'MAH001',
            description: 'Mahall identification number (optional)',
          },
          varisangyaGrade: {
            type: 'string',
            enum: ['Grade A', 'Grade B', 'Grade C', 'Grade D'],
            example: 'Grade A',
            description: 'Varisangya grade classification (optional)',
          },
          familyHead: {
            type: 'string',
            example: 'Ahmed Ali',
            description: 'Name of family head (optional)',
          },
          contactNo: {
            type: 'string',
            example: '9876543210',
            description: 'Contact phone number (optional)',
          },
          wardNumber: {
            type: 'string',
            example: 'Ward 5',
            description: 'Ward number (optional)',
          },
          houseNo: {
            type: 'string',
            example: 'H-123',
            description: 'House number (optional)',
          },
          area: {
            type: 'string',
            enum: ['Area A', 'Area B', 'Area C', 'Area D'],
            example: 'Area A',
            description: 'Area classification (optional)',
          },
          place: {
            type: 'string',
            example: 'Kozhikode',
            description: 'Place name (optional)',
          },
          via: {
            type: 'string',
            example: 'Via Calicut',
            description: 'Via location (optional)',
          },
          state: {
            type: 'string',
            example: 'Kerala',
            description: 'State name (required)',
          },
          district: {
            type: 'string',
            example: 'Kozhikode',
            description: 'District name (required)',
          },
          pinCode: {
            type: 'string',
            example: '673001',
            description: 'PIN code (optional)',
          },
          postOffice: {
            type: 'string',
            example: 'Kozhikode HO',
            description: 'Post office name (optional)',
          },
          lsgName: {
            type: 'string',
            example: 'Kozhikode Corporation',
            description: 'Local Self Government name (required)',
          },
          village: {
            type: 'string',
            example: 'Kozhikode',
            description: 'Village name (required)',
          },
          status: {
            type: 'string',
            enum: ['approved', 'unapproved', 'pending'],
            example: 'pending',
            default: 'pending',
            description: 'Family approval status (optional)',
          },
        },
      },
      Member: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439014' },
          name: {
            type: 'string',
            example: 'Ahmed Ali',
            minLength: 2,
            maxLength: 100,
            required: true,
          },
          familyId: {
            type: 'string',
            example: '507f1f77bcf86cd799439013',
            description: 'MongoDB ObjectId of the family',
            required: true,
          },
          familyName: {
            type: 'string',
            example: 'Al-Hamd House',
            required: true,
          },
          age: {
            type: 'number',
            example: 25,
            minimum: 0,
            maximum: 150,
            description: 'Age in years (optional)',
          },
          gender: {
            type: 'string',
            enum: ['male', 'female'],
            example: 'male',
            description: 'Gender (optional)',
          },
          bloodGroup: {
            type: 'string',
            enum: ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'],
            example: 'O +ve',
            description: 'Blood group (optional)',
          },
          healthStatus: {
            type: 'string',
            example: 'Healthy',
            description: 'Health status information (optional)',
          },
          healthNotes: {
            type: 'string',
            maxLength: 500,
            example: 'Type 2 diabetes, on insulin since 2019',
            description: 'Details of the health issue (optional, captured when healthStatus is not healthy)',
          },
          dateOfBirth: {
            type: 'string',
            format: 'date',
            example: '1999-04-12',
            description: 'Date of birth (optional). When provided, age is derived from it.',
          },
          relationshipOther: {
            type: 'string',
            maxLength: 100,
            example: 'Nephew',
            description: "Free-text relationship (optional, captured when relationship is 'other')",
          },
          phone: {
            type: 'string',
            example: '9876543210',
            pattern: '^[0-9]{10}$',
            description: 'Phone number (optional, must be 10 digits if provided)',
          },
          education: {
            type: 'string',
            example: 'Bachelor Degree',
            description: 'Education qualification (optional)',
          },
          externalInstitution: {
            type: 'string',
            maxLength: 150,
            example: 'Govt. Higher Secondary School',
            description: 'Free-text external school/college the member studies at (optional, for one not in the locality registry)',
          },
          mahallId: {
            type: 'string',
            example: 'MAH001',
            description: 'Mahall identification number (optional)',
          },
          tenantId: {
            type: 'string',
            example: '507f1f77bcf86cd799439012',
            required: true,
          },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'name', 'familyId', 'familyName', 'tenantId'],
      },
      CreateMemberRequest: {
        type: 'object',
        required: ['name', 'familyId', 'familyName'],
        properties: {
          name: {
            type: 'string',
            example: 'Ahmed Ali',
            minLength: 2,
            maxLength: 100,
            description: 'Full name of the member',
          },
          familyId: {
            type: 'string',
            example: '507f1f77bcf86cd799439013',
            description: 'MongoDB ObjectId of the family (required)',
          },
          familyName: {
            type: 'string',
            example: 'Al-Hamd House',
            description: 'Name of the family (required)',
          },
          age: {
            type: 'integer',
            example: 25,
            minimum: 0,
            maximum: 150,
            description: 'Age in years (optional)',
          },
          gender: {
            type: 'string',
            enum: ['male', 'female'],
            example: 'male',
            description: 'Gender (optional)',
          },
          bloodGroup: {
            type: 'string',
            enum: ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'],
            example: 'O +ve',
            description: 'Blood group (optional)',
          },
          healthStatus: {
            type: 'string',
            example: 'Healthy',
            description: 'Health status information (optional)',
          },
          healthNotes: {
            type: 'string',
            maxLength: 500,
            example: 'Type 2 diabetes, on insulin since 2019',
            description: 'Details of the health issue (optional, captured when healthStatus is not healthy)',
          },
          dateOfBirth: {
            type: 'string',
            format: 'date',
            example: '1999-04-12',
            description: 'Date of birth (optional). When provided, age is derived from it.',
          },
          relationshipOther: {
            type: 'string',
            maxLength: 100,
            example: 'Nephew',
            description: "Free-text relationship (optional, captured when relationship is 'other')",
          },
          phone: {
            type: 'string',
            example: '9876543210',
            pattern: '^[0-9]{10}$',
            description: 'Phone number (optional, must be exactly 10 digits)',
          },
          education: {
            type: 'string',
            example: 'Bachelor Degree',
            description: 'Education qualification (optional)',
          },
          externalInstitution: {
            type: 'string',
            maxLength: 150,
            example: 'Govt. Higher Secondary School',
            description: 'Free-text external school/college the member studies at (optional, for one not in the locality registry)',
          },
          mahallId: {
            type: 'string',
            example: 'MAH001',
            description: 'Mahall identification number (optional)',
          },
        },
      },
      Tenant: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439012' },
          name: {
            type: 'string',
            example: 'Kozhikode Mahallu',
            minLength: 2,
            maxLength: 200,
            required: true,
          },
          code: {
            type: 'string',
            example: 'KOZ001',
            pattern: '^[A-Z0-9]+$',
            description: 'Unique tenant code (uppercase letters and numbers only)',
            required: true,
          },
          type: {
            type: 'string',
            enum: ['standard', 'premium', 'enterprise'],
            example: 'standard',
            default: 'standard',
          },
          location: {
            type: 'string',
            example: 'Kozhikode, Kerala',
            description: 'Location description (optional)',
          },
          address: {
            type: 'object',
            required: ['state', 'district', 'lsgName', 'village'],
            properties: {
              state: {
                type: 'string',
                example: 'Kerala',
                description: 'State name (required)',
              },
              district: {
                type: 'string',
                example: 'Kozhikode',
                description: 'District name (required)',
              },
              pinCode: {
                type: 'string',
                example: '673001',
                description: 'PIN code (optional)',
              },
              postOffice: {
                type: 'string',
                example: 'Kozhikode HO',
                description: 'Post office name (optional)',
              },
              lsgName: {
                type: 'string',
                example: 'Kozhikode Corporation',
                description: 'Local Self Government name (required)',
              },
              village: {
                type: 'string',
                example: 'Kozhikode',
                description: 'Village name (required)',
              },
            },
          },
          status: {
            type: 'string',
            enum: ['active', 'suspended', 'inactive'],
            example: 'active',
            default: 'active',
          },
          subscription: {
            type: 'object',
            properties: {
              plan: { type: 'string', example: 'basic' },
              startDate: { type: 'string', format: 'date-time' },
              endDate: { type: 'string', format: 'date-time' },
              isActive: { type: 'boolean', example: true },
            },
          },
          settings: {
            type: 'object',
            properties: {
              varisangyaAmount: { type: 'number', example: 100 },
              features: { type: 'object' },
            },
          },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'name', 'code', 'address'],
      },
      CreateTenantRequest: {
        type: 'object',
        required: ['name', 'code', 'address'],
        properties: {
          name: {
            type: 'string',
            example: 'Kozhikode Mahallu',
            minLength: 2,
            maxLength: 200,
            description: 'Tenant name',
          },
          code: {
            type: 'string',
            example: 'KOZ001',
            pattern: '^[A-Z0-9]+$',
            minLength: 2,
            maxLength: 50,
            description: 'Unique tenant code (uppercase letters and numbers only)',
          },
          type: {
            type: 'string',
            enum: ['standard', 'premium', 'enterprise'],
            example: 'standard',
            default: 'standard',
            description: 'Tenant subscription type',
          },
          location: {
            type: 'string',
            example: 'Kozhikode, Kerala',
            description: 'Location description (optional)',
          },
          address: {
            type: 'object',
            required: ['state', 'district', 'lsgName', 'village'],
            properties: {
              state: {
                type: 'string',
                example: 'Kerala',
                description: 'State name',
              },
              district: {
                type: 'string',
                example: 'Kozhikode',
                description: 'District name',
              },
              pinCode: {
                type: 'string',
                example: '673001',
                description: 'PIN code (optional)',
              },
              postOffice: {
                type: 'string',
                example: 'Kozhikode HO',
                description: 'Post office name (optional)',
              },
              lsgName: {
                type: 'string',
                example: 'Kozhikode Corporation',
                description: 'Local Self Government name',
              },
              village: {
                type: 'string',
                example: 'Kozhikode',
                description: 'Village name',
              },
            },
          },
          settings: {
            type: 'object',
            properties: {
              varisangyaAmount: {
                type: 'number',
                example: 100,
                minimum: 0,
                description: 'Default varisangya amount (optional)',
              },
            },
          },
        },
      },
      Institute: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439015' },
          name: { type: 'string', example: 'Al-Azhar Institute', minLength: 2, maxLength: 200 },
          place: { type: 'string', example: 'Kozhikode', minLength: 1, maxLength: 200 },
          type: { type: 'string', enum: ['institute', 'program', 'madrasa'], example: 'institute' },
          joinDate: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          description: { type: 'string', example: 'Islamic educational institute' },
          contactNo: { type: 'string', example: '9876543210', pattern: '^[0-9]{10}$' },
          email: { type: 'string', format: 'email', example: 'info@alazhar.in' },
          address: {
            type: 'object',
            properties: {
              state: { type: 'string', example: 'Kerala' },
              district: { type: 'string', example: 'Kozhikode' },
              pinCode: { type: 'string', example: '673001' },
              postOffice: { type: 'string', example: 'Kozhikode HO' },
            },
          },
          status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'name', 'place', 'type', 'status', 'tenantId'],
      },
      CreateInstituteRequest: {
        type: 'object',
        required: ['name', 'place', 'type'],
        properties: {
          name: { type: 'string', example: 'Al-Azhar Institute', minLength: 2, maxLength: 200 },
          place: { type: 'string', example: 'Kozhikode', minLength: 1, maxLength: 200 },
          type: { type: 'string', enum: ['institute', 'program', 'madrasa'], example: 'institute' },
          joinDate: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          description: { type: 'string', example: 'Islamic educational institute' },
          contactNo: { type: 'string', example: '9876543210', pattern: '^[0-9]{10}$' },
          email: { type: 'string', format: 'email', example: 'info@alazhar.in' },
          address: {
            type: 'object',
            properties: {
              state: { type: 'string', example: 'Kerala' },
              district: { type: 'string', example: 'Kozhikode' },
              pinCode: { type: 'string', example: '673001' },
              postOffice: { type: 'string', example: 'Kozhikode HO' },
            },
          },
          status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
        },
      },
      UpdateInstituteRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Al-Azhar Institute Updated', minLength: 2, maxLength: 200 },
          place: { type: 'string', example: 'Kozhikode', minLength: 1, maxLength: 200 },
          type: { type: 'string', enum: ['institute', 'program', 'madrasa'] },
          joinDate: { type: 'string', format: 'date-time' },
          description: { type: 'string' },
          contactNo: { type: 'string', pattern: '^[0-9]{10}$' },
          email: { type: 'string', format: 'email' },
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
      },
      Program: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439016' },
          name: { type: 'string', example: 'Youth Education Program', minLength: 2, maxLength: 200 },
          place: { type: 'string', example: 'Kozhikode', minLength: 1, maxLength: 200 },
          type: { type: 'string', enum: ['institute', 'program', 'madrasa'], example: 'program' },
          joinDate: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          description: { type: 'string', example: 'Educational program for youth' },
          contactNo: { type: 'string', example: '9876543210', pattern: '^[0-9]{10}$' },
          email: { type: 'string', format: 'email', example: 'program@example.com' },
          address: {
            type: 'object',
            properties: {
              state: { type: 'string', example: 'Kerala' },
              district: { type: 'string', example: 'Kozhikode' },
              pinCode: { type: 'string', example: '673001' },
              postOffice: { type: 'string', example: 'Kozhikode HO' },
            },
          },
          status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'name', 'place', 'type', 'status', 'tenantId'],
      },
      CreateProgramRequest: {
        type: 'object',
        required: ['name', 'place', 'type'],
        properties: {
          name: { type: 'string', example: 'Youth Education Program', minLength: 2, maxLength: 200 },
          place: { type: 'string', example: 'Kozhikode', minLength: 1, maxLength: 200 },
          type: { type: 'string', enum: ['institute', 'program', 'madrasa'], example: 'program' },
          joinDate: { type: 'string', format: 'date-time' },
          description: { type: 'string' },
          contactNo: { type: 'string', pattern: '^[0-9]{10}$' },
          email: { type: 'string', format: 'email' },
          address: {
            type: 'object',
            properties: {
              state: { type: 'string' },
              district: { type: 'string' },
              pinCode: { type: 'string' },
              postOffice: { type: 'string' },
            },
          },
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
      },
      UpdateProgramRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 200 },
          place: { type: 'string', minLength: 1, maxLength: 200 },
          type: { type: 'string', enum: ['institute', 'program', 'madrasa'] },
          joinDate: { type: 'string', format: 'date-time' },
          description: { type: 'string' },
          contactNo: { type: 'string', pattern: '^[0-9]{10}$' },
          email: { type: 'string', format: 'email' },
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
      },
      Madrasa: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439017' },
          name: { type: 'string', example: 'Darul Uloom Madrasa', minLength: 2, maxLength: 200 },
          place: { type: 'string', example: 'Kozhikode', minLength: 1, maxLength: 200 },
          type: { type: 'string', enum: ['institute', 'program', 'madrasa'], example: 'madrasa' },
          joinDate: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          description: { type: 'string', example: 'Islamic educational institution' },
          contactNo: { type: 'string', example: '9876543210', pattern: '^[0-9]{10}$' },
          email: { type: 'string', format: 'email', example: 'info@darululoom.in' },
          address: {
            type: 'object',
            properties: {
              state: { type: 'string', example: 'Kerala' },
              district: { type: 'string', example: 'Kozhikode' },
              pinCode: { type: 'string', example: '673001' },
              postOffice: { type: 'string', example: 'Kozhikode HO' },
            },
          },
          status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'name', 'place', 'type', 'status', 'tenantId'],
      },
      CreateMadrasaRequest: {
        type: 'object',
        required: ['name', 'place', 'type'],
        properties: {
          name: { type: 'string', example: 'Darul Uloom Madrasa', minLength: 2, maxLength: 200 },
          place: { type: 'string', example: 'Kozhikode', minLength: 1, maxLength: 200 },
          type: { type: 'string', enum: ['institute', 'program', 'madrasa'], example: 'madrasa' },
          joinDate: { type: 'string', format: 'date-time' },
          description: { type: 'string' },
          contactNo: { type: 'string', pattern: '^[0-9]{10}$' },
          email: { type: 'string', format: 'email' },
          address: {
            type: 'object',
            properties: {
              state: { type: 'string' },
              district: { type: 'string' },
              pinCode: { type: 'string' },
              postOffice: { type: 'string' },
            },
          },
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
      },
      UpdateMadrasaRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 200 },
          place: { type: 'string', minLength: 1, maxLength: 200 },
          type: { type: 'string', enum: ['institute', 'program', 'madrasa'] },
          joinDate: { type: 'string', format: 'date-time' },
          description: { type: 'string' },
          contactNo: { type: 'string', pattern: '^[0-9]{10}$' },
          email: { type: 'string', format: 'email' },
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
      },
      Committee: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439018' },
          name: { type: 'string', example: 'Finance Committee', minLength: 2, maxLength: 200 },
          description: { type: 'string', example: 'Manages financial matters' },
          members: {
            type: 'array',
            items: { type: 'string', example: '507f1f77bcf86cd799439014' },
            description: 'Array of member IDs',
          },
          status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'name', 'status', 'tenantId'],
      },
      CreateCommitteeRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Finance Committee', minLength: 2, maxLength: 200 },
          description: { type: 'string', example: 'Manages financial matters' },
          members: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of member IDs',
          },
          status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
        },
      },
      UpdateCommitteeRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 200 },
          description: { type: 'string' },
          members: {
            type: 'array',
            items: { type: 'string' },
          },
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
      },
      Meeting: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439019' },
          committeeId: { type: 'string', example: '507f1f77bcf86cd799439018' },
          title: { type: 'string', example: 'Monthly Finance Meeting', minLength: 2, maxLength: 200 },
          meetingDate: { type: 'string', format: 'date-time', example: '2024-02-01T10:00:00.000Z' },
          attendance: {
            type: 'array',
            items: { type: 'string', example: '507f1f77bcf86cd799439014' },
            description: 'Array of member IDs who attended',
          },
          totalMembers: { type: 'number', example: 10, minimum: 0 },
          attendancePercent: { type: 'number', example: 20, minimum: 0, maximum: 100 },
          agenda: { type: 'string', example: 'Review monthly expenses and budget' },
          minutes: { type: 'string', example: 'Meeting completed successfully' },
          status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled'], example: 'scheduled' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'committeeId', 'title', 'meetingDate', 'status', 'tenantId'],
      },
      CreateMeetingRequest: {
        type: 'object',
        required: ['committeeId', 'title', 'meetingDate'],
        properties: {
          committeeId: { type: 'string', example: '507f1f77bcf86cd799439018' },
          title: { type: 'string', example: 'Monthly Finance Meeting', minLength: 2, maxLength: 200 },
          meetingDate: { type: 'string', format: 'date-time', example: '2024-02-01T10:00:00.000Z' },
          attendance: {
            type: 'array',
            items: { type: 'string' },
          },
          totalMembers: { type: 'number', minimum: 0 },
          attendancePercent: { type: 'number', minimum: 0, maximum: 100 },
          agenda: { type: 'string' },
          minutes: { type: 'string' },
          status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled'], example: 'scheduled' },
        },
      },
      UpdateMeetingRequest: {
        type: 'object',
        properties: {
          committeeId: { type: 'string' },
          title: { type: 'string', minLength: 2, maxLength: 200 },
          meetingDate: { type: 'string', format: 'date-time' },
          attendance: {
            type: 'array',
            items: { type: 'string' },
          },
          totalMembers: { type: 'number', minimum: 0 },
          attendancePercent: { type: 'number', minimum: 0, maximum: 100 },
          agenda: { type: 'string' },
          minutes: { type: 'string' },
          status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled'] },
        },
      },
      NikahRegistration: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439020' },
          groomName: { type: 'string', example: 'Ahmed Ali', minLength: 2, maxLength: 100 },
          groomAge: { type: 'number', example: 28, minimum: 0, maximum: 150 },
          groomId: { type: 'string', example: '507f1f77bcf86cd799439014' },
          brideName: { type: 'string', example: 'Fatima Khan', minLength: 2, maxLength: 100 },
          brideAge: { type: 'number', example: 25, minimum: 0, maximum: 150 },
          brideId: { type: 'string', example: '507f1f77bcf86cd799439015' },
          nikahDate: { type: 'string', format: 'date-time', example: '2024-02-14T10:00:00.000Z' },
          mahallId: { type: 'string', example: 'MAH001' },
          waliName: { type: 'string', example: 'Mohammed Khan' },
          witness1: { type: 'string', example: 'Abdul Rahman' },
          witness2: { type: 'string', example: 'Ibrahim Ali' },
          mahrAmount: { type: 'number', example: 50000, minimum: 0 },
          mahrDescription: { type: 'string', example: 'Gold and cash' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
          remarks: { type: 'string', example: 'Registration pending approval' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'groomName', 'brideName', 'nikahDate', 'status', 'tenantId'],
      },
      CreateNikahRegistrationRequest: {
        type: 'object',
        required: ['groomName', 'brideName', 'nikahDate'],
        properties: {
          groomName: { type: 'string', example: 'Ahmed Ali', minLength: 2, maxLength: 100 },
          groomAge: { type: 'number', minimum: 0, maximum: 150 },
          groomId: { type: 'string' },
          brideName: { type: 'string', example: 'Fatima Khan', minLength: 2, maxLength: 100 },
          brideAge: { type: 'number', minimum: 0, maximum: 150 },
          brideId: { type: 'string' },
          nikahDate: { type: 'string', format: 'date-time', example: '2024-02-14T10:00:00.000Z' },
          mahallId: { type: 'string' },
          waliName: { type: 'string' },
          witness1: { type: 'string' },
          witness2: { type: 'string' },
          mahrAmount: { type: 'number', minimum: 0 },
          mahrDescription: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
          remarks: { type: 'string' },
        },
      },
      DeathRegistration: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439021' },
          deceasedName: { type: 'string', example: 'Ahmed Ali', minLength: 2, maxLength: 100 },
          deceasedId: { type: 'string', example: '507f1f77bcf86cd799439014' },
          deathDate: { type: 'string', format: 'date-time', example: '2024-02-10T00:00:00.000Z' },
          placeOfDeath: { type: 'string', example: 'Kozhikode Hospital' },
          causeOfDeath: { type: 'string', example: 'Natural causes' },
          mahallId: { type: 'string', example: 'MAH001' },
          familyId: { type: 'string', example: '507f1f77bcf86cd799439013' },
          informantName: { type: 'string', example: 'Mohammed Ali' },
          informantRelation: { type: 'string', example: 'Son' },
          informantPhone: { type: 'string', example: '9876543210', pattern: '^[0-9]{10}$' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
          remarks: { type: 'string', example: 'Registration pending approval' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'deceasedName', 'deathDate', 'status', 'tenantId'],
      },
      CreateDeathRegistrationRequest: {
        type: 'object',
        required: ['deceasedName', 'deathDate'],
        properties: {
          deceasedName: { type: 'string', example: 'Ahmed Ali', minLength: 2, maxLength: 100 },
          deceasedId: { type: 'string' },
          deathDate: { type: 'string', format: 'date-time', example: '2024-02-10T00:00:00.000Z' },
          placeOfDeath: { type: 'string' },
          causeOfDeath: { type: 'string' },
          mahallId: { type: 'string' },
          familyId: { type: 'string' },
          informantName: { type: 'string' },
          informantRelation: { type: 'string' },
          informantPhone: { type: 'string', pattern: '^[0-9]{10}$' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
          remarks: { type: 'string' },
        },
      },
      NOC: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439022' },
          applicantName: { type: 'string', example: 'Ahmed Ali', minLength: 2, maxLength: 100 },
          applicantId: { type: 'string', example: '507f1f77bcf86cd799439014' },
          applicantPhone: { type: 'string', example: '9876543210', pattern: '^[0-9]{10}$' },
          purpose: { type: 'string', example: 'Travel abroad for business', minLength: 2, maxLength: 500 },
          type: { type: 'string', enum: ['common', 'nikah'], example: 'common' },
          nikahRegistrationId: { type: 'string', example: '507f1f77bcf86cd799439020' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
          issuedDate: { type: 'string', format: 'date-time', example: '2024-02-15T00:00:00.000Z' },
          expiryDate: { type: 'string', format: 'date-time', example: '2024-08-15T00:00:00.000Z' },
          remarks: { type: 'string', example: 'NOC approved for travel' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'applicantName', 'purpose', 'type', 'status', 'tenantId'],
      },
      CreateNOCRequest: {
        type: 'object',
        required: ['applicantName', 'purpose', 'type'],
        properties: {
          applicantName: { type: 'string', example: 'Ahmed Ali', minLength: 2, maxLength: 100 },
          applicantId: { type: 'string' },
          applicantPhone: { type: 'string', pattern: '^[0-9]{10}$' },
          purpose: { type: 'string', example: 'Travel abroad for business', minLength: 2, maxLength: 500 },
          type: { type: 'string', enum: ['common', 'nikah'], example: 'common' },
          nikahRegistrationId: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
          issuedDate: { type: 'string', format: 'date-time' },
          expiryDate: { type: 'string', format: 'date-time' },
          remarks: { type: 'string' },
        },
      },
      UpdateNOCRequest: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
          issuedDate: { type: 'string', format: 'date-time' },
          expiryDate: { type: 'string', format: 'date-time' },
          remarks: { type: 'string' },
        },
      },
      Varisangya: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439023' },
          familyId: { type: 'string', example: '507f1f77bcf86cd799439013' },
          memberId: { type: 'string', example: '507f1f77bcf86cd799439014' },
          amount: { type: 'number', example: 500, minimum: 0 },
          paymentDate: { type: 'string', format: 'date-time', example: '2024-02-01T00:00:00.000Z' },
          paymentMethod: { type: 'string', example: 'Cash' },
          receiptNo: { type: 'string', example: 'REC001' },
          remarks: { type: 'string', example: 'Monthly contribution' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'amount', 'paymentDate', 'tenantId'],
      },
      CreateVarisangyaRequest: {
        type: 'object',
        required: ['amount', 'paymentDate'],
        properties: {
          familyId: { type: 'string' },
          memberId: { type: 'string' },
          amount: { type: 'number', example: 500, minimum: 0 },
          paymentDate: { type: 'string', format: 'date-time', example: '2024-02-01T00:00:00.000Z' },
          paymentMethod: { type: 'string', example: 'Cash' },
          receiptNo: { type: 'string', example: 'REC001' },
          remarks: { type: 'string' },
        },
      },
      Zakat: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439024' },
          payerName: { type: 'string', example: 'Ahmed Ali', minLength: 2, maxLength: 100 },
          payerId: { type: 'string', example: '507f1f77bcf86cd799439014' },
          amount: { type: 'number', example: 1000, minimum: 0 },
          paymentDate: { type: 'string', format: 'date-time', example: '2024-02-01T00:00:00.000Z' },
          paymentMethod: { type: 'string', example: 'Bank Transfer' },
          receiptNo: { type: 'string', example: 'ZAK001' },
          category: { type: 'string', example: 'Annual Zakat' },
          remarks: { type: 'string', example: 'Zakat for the year 2024' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'payerName', 'amount', 'paymentDate', 'tenantId'],
      },
      CreateZakatRequest: {
        type: 'object',
        required: ['payerName', 'amount', 'paymentDate'],
        properties: {
          payerName: { type: 'string', example: 'Ahmed Ali', minLength: 2, maxLength: 100 },
          payerId: { type: 'string' },
          amount: { type: 'number', example: 1000, minimum: 0 },
          paymentDate: { type: 'string', format: 'date-time', example: '2024-02-01T00:00:00.000Z' },
          paymentMethod: { type: 'string' },
          receiptNo: { type: 'string' },
          category: { type: 'string' },
          remarks: { type: 'string' },
        },
      },
      Wallet: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439025' },
          familyId: { type: 'string', example: '507f1f77bcf86cd799439013' },
          memberId: { type: 'string', example: '507f1f77bcf86cd799439014' },
          balance: { type: 'number', example: 5000, minimum: 0 },
          lastTransactionDate: { type: 'string', format: 'date-time', example: '2024-02-01T00:00:00.000Z' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'balance', 'tenantId'],
      },
      Transaction: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439026' },
          walletId: { type: 'string', example: '507f1f77bcf86cd799439025' },
          type: { type: 'string', enum: ['credit', 'debit'], example: 'credit' },
          amount: { type: 'number', example: 500, minimum: 0 },
          description: { type: 'string', example: 'Varisangya payment' },
          referenceId: { type: 'string', example: '507f1f77bcf86cd799439023' },
          referenceType: { type: 'string', enum: ['varisangya', 'zakat'], example: 'varisangya' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
        },
        required: ['_id', 'walletId', 'type', 'amount', 'description', 'tenantId'],
      },
      Banner: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439027' },
          title: { type: 'string', example: 'Ramadan Mubarak', minLength: 2, maxLength: 200 },
          image: { type: 'string', example: 'https://example.com/banner.jpg' },
          link: { type: 'string', example: 'https://example.com/ramadan-info' },
          status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
          startDate: { type: 'string', format: 'date-time', example: '2024-03-10T00:00:00.000Z' },
          endDate: { type: 'string', format: 'date-time', example: '2024-04-09T23:59:59.000Z' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'title', 'image', 'status', 'tenantId'],
      },
      CreateBannerRequest: {
        type: 'object',
        required: ['title', 'image'],
        properties: {
          title: { type: 'string', example: 'Ramadan Mubarak', minLength: 2, maxLength: 200 },
          image: { type: 'string', example: 'https://example.com/banner.jpg' },
          link: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
        },
      },
      Feed: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439028' },
          title: { type: 'string', example: 'Ramadan Announcement', minLength: 2, maxLength: 200 },
          content: { type: 'string', example: 'Ramadan Mubarak to all community members' },
          image: { type: 'string', example: 'https://example.com/ramadan.jpg' },
          authorId: { type: 'string', example: '507f1f77bcf86cd799439011' },
          isSuperFeed: { type: 'boolean', example: false },
          status: { type: 'string', enum: ['draft', 'published', 'archived'], example: 'published' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'title', 'content', 'authorId', 'status', 'tenantId'],
      },
      CreateFeedRequest: {
        type: 'object',
        required: ['title', 'content', 'authorId'],
        properties: {
          title: { type: 'string', example: 'Ramadan Announcement', minLength: 2, maxLength: 200 },
          content: { type: 'string', example: 'Ramadan Mubarak to all community members' },
          image: { type: 'string' },
          authorId: { type: 'string', example: '507f1f77bcf86cd799439011' },
          isSuperFeed: { type: 'boolean', example: false },
          status: { type: 'string', enum: ['draft', 'published', 'archived'], example: 'published' },
        },
      },
      ActivityLog: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439029' },
          userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
          action: { type: 'string', example: 'create' },
          entityType: { type: 'string', example: 'user' },
          entityId: { type: 'string', example: '507f1f77bcf86cd799439011' },
          httpMethod: { type: 'string', example: 'POST' },
          endpoint: { type: 'string', example: '/api/users' },
          ipAddress: { type: 'string', example: '192.168.1.1' },
          userAgent: { type: 'string', example: 'Mozilla/5.0...' },
          statusCode: { type: 'number', example: 200 },
          requestBody: { type: 'object' },
          responseData: { type: 'object' },
          errorMessage: { type: 'string' },
          details: { type: 'object' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
        },
        required: ['_id', 'action', 'entityType', 'httpMethod', 'endpoint'],
      },
      Support: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439030' },
          userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
          subject: { type: 'string', example: 'Login Issue', minLength: 2, maxLength: 200 },
          message: { type: 'string', example: "We couldn't sign you in. Please try again." },
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'], example: 'open' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], example: 'high' },
          response: { type: 'string', example: 'We are looking into this issue' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'userId', 'subject', 'message', 'status', 'priority', 'tenantId'],
      },
      CreateSupportRequest: {
        type: 'object',
        required: ['subject', 'message'],
        properties: {
          subject: { type: 'string', example: 'Login Issue', minLength: 2, maxLength: 200 },
          message: { type: 'string', example: "We couldn't sign you in. Please try again.", minLength: 10 },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], example: 'medium' },
        },
      },
      UpdateSupportRequest: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          response: { type: 'string' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439031' },
          recipientId: { type: 'string', example: '507f1f77bcf86cd799439011' },
          recipientType: { type: 'string', enum: ['user', 'member', 'all'], example: 'all' },
          title: { type: 'string', example: 'New Family Added', minLength: 2, maxLength: 200 },
          message: { type: 'string', example: 'A new family has been added to your mahallu' },
          type: { type: 'string', enum: ['info', 'warning', 'success', 'error'], example: 'info' },
          isRead: { type: 'boolean', example: false },
          link: { type: 'string', example: '/families/123' },
          tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
        required: ['_id', 'recipientType', 'title', 'message', 'type', 'isRead', 'tenantId'],
      },
      CreateNotificationRequest: {
        type: 'object',
        required: ['recipientType', 'title', 'message'],
        properties: {
          recipientId: { type: 'string' },
          recipientType: { type: 'string', enum: ['user', 'member', 'all'], example: 'all' },
          title: { type: 'string', example: 'New Family Added', minLength: 2, maxLength: 200 },
          message: { type: 'string', example: 'A new family has been added to your mahallu' },
          type: { type: 'string', enum: ['info', 'warning', 'success', 'error'], example: 'info' },
          link: { type: 'string' },
        },
      },
    },
    responses: {
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: {
                  type: 'boolean',
                  example: false,
                },
                message: {
                  type: 'string',
                  example: 'Some details are missing or incorrect. Please check the form and try again.',
                },
                errors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      msg: { type: 'string' },
                      param: { type: 'string' },
                      location: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized - Invalid or missing token',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden - Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      NotFound: {
        description: "We couldn't find that resource. It may have been removed.",
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Authentication',
      description: 'Authentication and user management endpoints',
    },
    {
      name: 'Tenants',
      description: 'Tenant management (Super Admin only)',
    },
    {
      name: 'Users',
      description: 'User management endpoints',
    },
    {
      name: 'Families',
      description: 'Family management endpoints',
    },
    {
      name: 'Members',
      description: 'Member management endpoints',
    },
    {
      name: 'Institutes',
      description: 'Institute management endpoints',
    },
    {
      name: 'Programs',
      description: 'Program management endpoints',
    },
    {
      name: 'Madrasa',
      description: 'Madrasa management endpoints',
    },
    {
      name: 'Committees',
      description: 'Committee management endpoints',
    },
    {
      name: 'Meetings',
      description: 'Meeting management endpoints',
    },
    {
      name: 'Registrations',
      description: 'Registration management (Nikah, Death, NOC)',
    },
    {
      name: 'Collectibles',
      description: 'Varisangya, Zakat, and Wallet management',
    },
    {
      name: 'Social',
      description: 'Banners, Feeds, Activity Logs, and Support',
    },
    {
      name: 'Notifications',
      description: 'Notification management',
    },
    {
      name: 'Master Accounts',
      description: 'Institute Accounts, Categories, Wallets, Ledgers management',
    },
    {
      name: 'Reports',
      description: 'Report generation endpoints',
    },
    {
      name: 'Dashboard',
      description: 'Dashboard statistics',
    },
    {
      name: 'Public',
      description: 'Public endpoints (no authentication required)',
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/index.ts',
  ], // Path to the API files
};

export const swaggerSpec = swaggerJsdoc(options);

