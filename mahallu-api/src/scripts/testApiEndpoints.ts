import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const SUPER_ADMIN_PHONE = '9999999999';
const SUPER_ADMIN_PASSWORD = 'admin123';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  message?: string;
  validationErrors?: any;
  data?: any;
}

class ApiTester {
  private token: string | null = null;
  private results: TestResult[] = [];
  private tenantId: string | null = null;
  private userId: string | null = null;
  private familyId: string | null = null;
  private memberId: string | null = null;
  private instituteId: string | null = null;
  private committeeId: string | null = null;
  private meetingId: string | null = null;

  private async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
    expectValidationError = false
  ): Promise<TestResult> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const config: RequestInit = {
        method,
        headers,
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      
      let responseData: any = {};
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          const text = await response.text();
          responseData = text ? { message: text } : { message: `HTTP ${response.status}` };
        }
      } catch (e: any) {
        responseData = { message: e.message || 'Failed to parse response' };
      }

      if (expectValidationError) {
        if (response.status === 400) {
          return {
            endpoint,
            method,
            status: 'PASS',
            statusCode: response.status,
            message: 'Validation error as expected',
            validationErrors: responseData.errors,
            data: responseData,
          };
        }
        return {
          endpoint,
          method,
          status: 'FAIL',
          statusCode: response.status,
          message: `Expected validation error (400) but got ${response.status}`,
          data: responseData,
        };
      }

      const result: TestResult = {
        endpoint,
        method,
        status: response.status >= 200 && response.status < 300 ? 'PASS' : 'FAIL',
        statusCode: response.status,
        message: responseData.success ? 'Success' : responseData.message || `Status ${response.status}`,
        data: responseData,
      };

      return result;
    } catch (error: any) {
      return {
        endpoint,
        method,
        status: 'FAIL',
        statusCode: 0,
        message: error.message || 'Request failed',
      };
    }
  }

  private addResult(result: TestResult) {
    this.results.push(result);
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(
      `${statusIcon} ${result.method} ${result.endpoint} - ${result.status} (${result.statusCode || 'N/A'})`
    );
    if (result.message) {
      console.log(`   ${result.message}`);
    }
    if (result.validationErrors) {
      console.log(`   Validation Errors:`, JSON.stringify(result.validationErrors, null, 2));
    }
    // Show full response for debugging failed requests
    if (result.status === 'FAIL' && result.data && Object.keys(result.data).length > 0) {
      console.log(`   Full Response:`, JSON.stringify(result.data, null, 2));
    }
  }

  async testAuthentication() {
    console.log('\n=== Testing Authentication ===');
    
    // Test login with invalid data (validation error)
    // Phone must be 10 digits, password is required
    const invalidLoginResult = await this.makeRequest('POST', '/auth/login', { phone: '123', password: '' }, true);
    this.addResult(invalidLoginResult);
    
    // Check if validation error was returned
    if (invalidLoginResult.statusCode !== 400) {
      console.log(`\n⚠️  Warning: Expected 400 validation error but got ${invalidLoginResult.statusCode}`);
      console.log(`   This suggests validation middleware might not be working correctly.`);
      console.log(`   Response:`, JSON.stringify(invalidLoginResult.data, null, 2));
      console.log(`   Check if validationHandler middleware is properly applied in authRoutes.ts\n`);
    } else {
      console.log(`   ✅ Validation working correctly - returned 400 for invalid data`);
    }

    // Test login with valid credentials
    const loginResult = await this.makeRequest('POST', '/auth/login', {
      phone: SUPER_ADMIN_PHONE,
      password: SUPER_ADMIN_PASSWORD,
    });
    this.addResult(loginResult);

    if (loginResult.status === 'PASS' && loginResult.data?.data?.token) {
      this.token = loginResult.data.data.token;
      this.userId = loginResult.data.data.user?._id;
      console.log('✅ Authentication successful, token obtained');
    } else {
      console.log('❌ Authentication failed, cannot continue tests');
      console.log('Status Code:', loginResult.statusCode);
      console.log('Response:', JSON.stringify(loginResult.data, null, 2));
      console.log('Message:', loginResult.message);
      
      if (loginResult.statusCode === 403) {
        console.log('\n⚠️  Possible issues:');
        console.log('   1. Super admin account might be inactive');
        console.log('   2. Super admin account might not exist');
        console.log('   3. Run: npm run create-admin to create super admin');
      }
      
      return false;
    }

    // Test get current user
    this.addResult(await this.makeRequest('GET', '/auth/me'));

    // Test change password with invalid data (validation error)
    this.addResult(
      await this.makeRequest('POST', '/auth/change-password', { currentPassword: '', newPassword: '123' }, true)
    );

    // Test send OTP with invalid phone (validation error)
    this.addResult(await this.makeRequest('POST', '/auth/send-otp', { phone: '123' }, true));

    // Test verify OTP with invalid data (validation error)
    this.addResult(
      await this.makeRequest('POST', '/auth/verify-otp', { phone: '123', otp: '123' }, true)
    );

    return true;
  }

  async testTenants() {
    console.log('\n=== Testing Tenants (Super Admin Only) ===');

    // Test get all tenants
    const getAllResult = await this.makeRequest('GET', '/tenants');
    this.addResult(getAllResult);

    // Test create tenant with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/tenants',
        { name: '', code: 'INVALID', type: 'invalid' },
        true
      )
    );

    // Test create tenant with valid data
    const createResult = await this.makeRequest('POST', '/tenants', {
      name: 'Test Tenant',
      code: 'TEST' + Date.now(),
      type: 'standard',
      address: {
        state: 'Kerala',
        district: 'Kozhikode',
        lsgName: 'Test LSG',
        village: 'Test Village',
      },
    });
    this.addResult(createResult);

    if (createResult.status === 'PASS' && createResult.data?.data?._id) {
      this.tenantId = createResult.data.data._id;
    }

    if (this.tenantId) {
      // Test get tenant by ID
      this.addResult(await this.makeRequest('GET', `/tenants/${this.tenantId}`));

      // Test get tenant stats
      this.addResult(await this.makeRequest('GET', `/tenants/${this.tenantId}/stats`));

      // Test update tenant with invalid data (validation error)
      this.addResult(
        await this.makeRequest('PUT', `/tenants/${this.tenantId}`, { status: 'invalid' }, true)
      );

      // Test update tenant
      this.addResult(
        await this.makeRequest('PUT', `/tenants/${this.tenantId}`, { name: 'Updated Tenant' })
      );

      // Test suspend tenant
      this.addResult(await this.makeRequest('POST', `/tenants/${this.tenantId}/suspend`));

      // Test activate tenant
      this.addResult(await this.makeRequest('POST', `/tenants/${this.tenantId}/activate`));
    }
  }

  async testUsers() {
    console.log('\n=== Testing Users ===');

    // Test get all users
    this.addResult(await this.makeRequest('GET', '/users'));

    // Test create user with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/users',
        { name: '', phone: '123', role: 'invalid' },
        true
      )
    );

    // Test create user with valid data
    const createResult = await this.makeRequest('POST', '/users', {
      name: 'Test User',
      phone: '9876543210',
      email: 'test@example.com',
      role: 'mahall',
      password: 'password123',
      tenantId: this.tenantId,
    });
    this.addResult(createResult);

    const createdUserId = createResult.data?.data?._id;
    if (createdUserId) {
      // Test get user by ID
      this.addResult(await this.makeRequest('GET', `/users/${createdUserId}`));

      // Test update user with invalid data (validation error)
      this.addResult(
        await this.makeRequest('PUT', `/users/${createdUserId}`, { email: 'invalid-email' }, true)
      );

      // Test update user
      this.addResult(await this.makeRequest('PUT', `/users/${createdUserId}`, { name: 'Updated User' }));
    }
  }

  async testFamilies() {
    console.log('\n=== Testing Families ===');

    // Test get all families
    this.addResult(await this.makeRequest('GET', '/families'));

    // Test create family with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/families',
        { houseName: '', state: '', district: '' },
        true
      )
    );

    // Test create family with valid data
    const createResult = await this.makeRequest('POST', '/families', {
      houseName: 'Test House',
      state: 'Kerala',
      district: 'Kozhikode',
      lsgName: 'Test LSG',
      village: 'Test Village',
      tenantId: this.tenantId,
    });
    this.addResult(createResult);

    this.familyId = createResult.data?.data?._id;
    if (this.familyId) {
      // Test get family by ID
      this.addResult(await this.makeRequest('GET', `/families/${this.familyId}`));

      // Test update family
      this.addResult(
        await this.makeRequest('PUT', `/families/${this.familyId}`, { houseName: 'Updated House' })
      );
    }
  }

  async testMembers() {
    console.log('\n=== Testing Members ===');

    if (!this.familyId) {
      console.log('⏭️ Skipping members test - no family ID');
      return;
    }

    // Test get all members
    this.addResult(await this.makeRequest('GET', '/members'));

    // Test create member with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/members',
        { name: '', familyId: 'invalid', age: 200 },
        true
      )
    );

    // Test create member with valid data
    const createResult = await this.makeRequest('POST', '/members', {
      name: 'Test Member',
      familyId: this.familyId,
      familyName: 'Test House',
      age: 25,
      gender: 'male',
      tenantId: this.tenantId,
    });
    this.addResult(createResult);

    this.memberId = createResult.data?.data?._id;
    if (this.memberId) {
      // Test get member by ID
      this.addResult(await this.makeRequest('GET', `/members/${this.memberId}`));

      // Test get members by family
      this.addResult(await this.makeRequest('GET', `/members/family/${this.familyId}`));
    }
  }

  async testInstitutes() {
    console.log('\n=== Testing Institutes ===');

    // Test get all institutes
    this.addResult(await this.makeRequest('GET', '/institutes'));

    // Test create institute with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/institutes',
        { name: '', place: '', type: 'invalid' },
        true
      )
    );

    // Test create institute with valid data
    const createResult = await this.makeRequest('POST', '/institutes', {
      name: 'Test Institute',
      place: 'Test Place',
      type: 'institute',
      tenantId: this.tenantId,
    });
    this.addResult(createResult);

    this.instituteId = createResult.data?.data?._id;
    if (this.instituteId) {
      // Test get institute by ID
      this.addResult(await this.makeRequest('GET', `/institutes/${this.instituteId}`));
    }
  }

  async testPrograms() {
    console.log('\n=== Testing Programs ===');

    // Test get all programs
    this.addResult(await this.makeRequest('GET', '/programs'));

    // Test create program with invalid data (validation error)
    this.addResult(
      await this.makeRequest('POST', '/programs', { name: '', place: '' }, true)
    );

    // Test create program with valid data
    const createResult = await this.makeRequest('POST', '/programs', {
      name: 'Test Program',
      place: 'Test Place',
      tenantId: this.tenantId,
    });
    this.addResult(createResult);
  }

  async testMadrasas() {
    console.log('\n=== Testing Madrasas ===');

    // Madrasa has no bare collection endpoint - classes and enrollments are
    // the actual resources (see routes/madrasaRoutes.ts).
    this.addResult(await this.makeRequest('GET', '/madrasa/classes'));
    this.addResult(await this.makeRequest('GET', '/madrasa/summary'));

    // Test create class with invalid data (validation error)
    this.addResult(
      await this.makeRequest('POST', '/madrasa/classes', { name: '' }, true)
    );

    // Test create class with valid data
    const createResult = await this.makeRequest('POST', '/madrasa/classes', {
      name: 'Test Class',
      academicYear: '2025-26',
      tenantId: this.tenantId,
    });
    this.addResult(createResult);
  }

  async testCommittees() {
    console.log('\n=== Testing Committees ===');

    // Test get all committees
    this.addResult(await this.makeRequest('GET', '/committees'));

    // Test create committee with invalid data (validation error)
    this.addResult(
      await this.makeRequest('POST', '/committees', { name: '', status: 'invalid' }, true)
    );

    // Test create committee with valid data
    const createResult = await this.makeRequest('POST', '/committees', {
      name: 'Test Committee',
      tenantId: this.tenantId,
    });
    this.addResult(createResult);

    this.committeeId = createResult.data?.data?._id;
    if (this.committeeId) {
      // Test get committee by ID
      this.addResult(await this.makeRequest('GET', `/committees/${this.committeeId}`));

      // Test get committee meetings
      this.addResult(await this.makeRequest('GET', `/committees/${this.committeeId}/meetings`));
    }
  }

  async testMeetings() {
    console.log('\n=== Testing Meetings ===');

    if (!this.committeeId) {
      console.log('⏭️ Skipping meetings test - no committee ID');
      return;
    }

    // Test get all meetings
    this.addResult(await this.makeRequest('GET', '/meetings'));

    // Test create meeting with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/meetings',
        { title: '', committeeId: 'invalid', meetingDate: 'invalid' },
        true
      )
    );

    // Test create meeting with valid data
    const createResult = await this.makeRequest('POST', '/meetings', {
      title: 'Test Meeting',
      committeeId: this.committeeId,
      meetingDate: new Date().toISOString(),
      tenantId: this.tenantId,
    });
    this.addResult(createResult);

    this.meetingId = createResult.data?.data?._id;
  }

  async testRegistrations() {
    console.log('\n=== Testing Registrations ===');

    // Test Nikah Registration with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/registrations/nikah',
        { groomName: '', brideName: '', nikahDate: 'invalid' },
        true
      )
    );

    // Test Death Registration with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/registrations/death',
        { deceasedName: '', deathDate: 'invalid' },
        true
      )
    );

    // Test NOC with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/registrations/noc',
        { applicantName: '', purpose: '', type: 'invalid' },
        true
      )
    );
  }

  async testCollectibles() {
    console.log('\n=== Testing Collectibles ===');

    // Test create Varisangya with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/collectibles/varisangya',
        { amount: -100, paymentDate: 'invalid' },
        true
      )
    );

    // Test create Zakat with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/collectibles/zakat',
        { payerName: '', amount: -100, paymentDate: 'invalid' },
        true
      )
    );
  }

  async testSocial() {
    console.log('\n=== Testing Social ===');

    // Test create Banner with invalid data (validation error)
    this.addResult(
      await this.makeRequest('POST', '/social/banners', { title: '', image: '' }, true)
    );

    // Test create Feed with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/social/feeds',
        { title: '', content: '', authorId: 'invalid' },
        true
      )
    );

    // Test create Support with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/social/support',
        { subject: '', message: 'short', priority: 'invalid' },
        true
      )
    );
  }

  async testNotifications() {
    console.log('\n=== Testing Notifications ===');

    // Test create notification with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/notifications',
        { title: '', message: '', recipientType: 'invalid' },
        true
      )
    );
  }

  async testMasterAccounts() {
    console.log('\n=== Testing Master Accounts ===');

    if (!this.instituteId) {
      console.log('⏭️ Skipping master accounts test - no institute ID');
      return;
    }

    // Test create Institute Account with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/master-accounts/institute',
        { accountName: '', instituteId: 'invalid' },
        true
      )
    );

    // Test create Category with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/master-accounts/categories',
        { name: '', type: 'invalid' },
        true
      )
    );

    // Test create Wallet with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/master-accounts/wallets',
        { name: '', type: 'invalid' },
        true
      )
    );

    // Test create Ledger with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/master-accounts/ledgers',
        { name: '', type: 'invalid' },
        true
      )
    );

    // Test create Ledger Item with invalid data (validation error)
    this.addResult(
      await this.makeRequest(
        'POST',
        '/master-accounts/ledger-items',
        { ledgerId: 'invalid', date: 'invalid', amount: -100, description: '' },
        true
      )
    );
  }

  async testReports() {
    console.log('\n=== Testing Reports ===');

    // Test get area report
    this.addResult(await this.makeRequest('GET', '/reports/area'));

    // Test get blood bank report
    this.addResult(await this.makeRequest('GET', '/reports/blood-bank'));

    // Test get orphans report
    this.addResult(await this.makeRequest('GET', '/reports/orphans'));
  }

  async testDashboard() {
    console.log('\n=== Testing Dashboard ===');

    // Test get dashboard stats
    this.addResult(await this.makeRequest('GET', '/dashboard/stats'));
  }

  async runAllTests() {
    console.log('🚀 Starting API Endpoint Tests with Super Admin');
    console.log(`Base URL: ${BASE_URL}`);
    console.log('='.repeat(60));
    console.log('\n⚠️  Note: Make sure super admin exists and is active.');
    console.log('   Run: npm run create-admin (if super admin does not exist)');
    console.log('='.repeat(60));

    const authSuccess = await this.testAuthentication();
    if (!authSuccess) {
      console.log('\n❌ Authentication failed. Cannot continue tests.');
      console.log('\n💡 Troubleshooting:');
      console.log('   1. Ensure API server is running: npm run dev');
      console.log('   2. Create super admin: npm run create-admin');
      console.log('   3. Verify super admin phone: 9999999999');
      console.log('   4. Verify super admin password: admin123');
      this.printSummary();
      return;
    }

    await this.testTenants();
    await this.testUsers();
    await this.testFamilies();
    await this.testMembers();
    await this.testInstitutes();
    await this.testPrograms();
    await this.testMadrasas();
    await this.testCommittees();
    await this.testMeetings();
    await this.testRegistrations();
    await this.testCollectibles();
    await this.testSocial();
    await this.testNotifications();
    await this.testMasterAccounts();
    await this.testReports();
    await this.testDashboard();

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));

    const passed = this.results.filter((r) => r.status === 'PASS').length;
    const failed = this.results.filter((r) => r.status === 'FAIL').length;
    const skipped = this.results.filter((r) => r.status === 'SKIP').length;

    console.log(`Total Tests: ${this.results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`Success Rate: ${((passed / this.results.length) * 100).toFixed(2)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => {
          console.log(`  - ${r.method} ${r.endpoint} (${r.statusCode || 'N/A'}): ${r.message}`);
        });
    }
  }
}

// Run tests
const tester = new ApiTester();
tester.runAllTests().catch((error) => {
  console.error('Test execution error:', error);
  process.exit(1);
});

