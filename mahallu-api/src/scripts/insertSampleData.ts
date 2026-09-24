import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../config/database';
import User from '../models/User';
import Tenant from '../models/Tenant';
import Family from '../models/Family';
import Member from '../models/Member';
import Institute from '../models/Institute';
import Committee from '../models/Committee';
import { Varisangya, Zakat } from '../models/Collectible';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import Meeting from '../models/Meeting';

dotenv.config();

interface SampleData {
  tenants: mongoose.Types.ObjectId[];
  users: mongoose.Types.ObjectId[];
  families: mongoose.Types.ObjectId[];
  members: mongoose.Types.ObjectId[];
  institutes: mongoose.Types.ObjectId[];
  committees: mongoose.Types.ObjectId[];
}

async function insertSampleData() {
  try {
    await connectDatabase();
    console.log('\n🚀 Starting to insert sample data...\n');

    const sampleData: SampleData = {
      tenants: [],
      users: [],
      families: [],
      members: [],
      institutes: [],
      committees: [],
    };

    // 1. Create Tenants
    console.log('📦 Creating tenants...');
    const tenantsData = [
      {
        name: 'Kozhikode Central Mahallu',
        code: 'KZM001',
        type: 'premium' as const,
        location: 'Kozhikode',
        address: {
          state: 'Kerala',
          district: 'Kozhikode',
          pinCode: '673001',
          postOffice: 'Kozhikode',
          lsgName: 'Kozhikode Corporation',
          village: 'Kozhikode',
        },
        status: 'active' as const,
        subscription: {
          plan: 'premium',
          startDate: new Date(),
          isActive: true,
        },
        settings: {
          varisangyaAmount: 100,
          features: {},
        },
      },
      {
        name: 'Malappuram Mahallu',
        code: 'MLM001',
        type: 'standard' as const,
        location: 'Malappuram',
        address: {
          state: 'Kerala',
          district: 'Malappuram',
          pinCode: '676001',
          postOffice: 'Malappuram',
          lsgName: 'Malappuram Municipality',
          village: 'Malappuram',
        },
        status: 'active' as const,
        subscription: {
          plan: 'basic',
          startDate: new Date(),
          isActive: true,
        },
        settings: {
          varisangyaAmount: 50,
          features: {},
        },
      },
    ];

    for (const tenantData of tenantsData) {
      const existingTenant = await Tenant.findOne({ code: tenantData.code });
      if (existingTenant) {
        console.log(`⏭️  Skipped tenant: ${tenantData.name} (already exists)`);
        sampleData.tenants.push(existingTenant._id);
      } else {
        const tenant = new Tenant(tenantData);
        await tenant.save();
        sampleData.tenants.push(tenant._id);
        console.log(`✅ Created tenant: ${tenant.name} (${tenant.code})`);
      }
    }

    // 2. Create Users
    console.log('\n👥 Creating users...');
    const usersData = [
      {
        name: 'Super Admin',
        phone: '9999999999',
        email: 'superadmin@mahallu.com',
        password: await bcrypt.hash('123456', 10),
        role: 'super_admin' as const,
        isSuperAdmin: true,
        tenantId: null,
        status: 'active' as const,
        permissions: {
          view: true,
          add: true,
          edit: true,
          delete: true,
        },
      },
      {
        name: 'Ahmed Ali',
        phone: '9876543210',
        email: 'ahmed.ali@mahallu.com',
        password: await bcrypt.hash('123456', 10),
        role: 'mahall' as const,
        isSuperAdmin: false,
        tenantId: sampleData.tenants[0],
        status: 'active' as const,
        permissions: {
          view: true,
          add: true,
          edit: true,
          delete: false,
        },
      },
      {
        name: 'Fatima Khan',
        phone: '9876543211',
        email: 'fatima.khan@mahallu.com',
        password: await bcrypt.hash('123456', 10),
        role: 'mahall' as const,
        isSuperAdmin: false,
        tenantId: sampleData.tenants[0],
        status: 'active' as const,
        permissions: {
          view: true,
          add: true,
          edit: true,
          delete: false,
        },
      },
      {
        name: 'Mohammed Ibrahim',
        phone: '9876543212',
        email: 'mohammed.ibrahim@mahallu.com',
        password: await bcrypt.hash('123456', 10),
        role: 'mahall' as const,
        isSuperAdmin: false,
        tenantId: sampleData.tenants[1],
        status: 'active' as const,
        permissions: {
          view: true,
          add: false,
          edit: false,
          delete: false,
        },
      },
    ];

    for (const userData of usersData) {
      const existingUser = await User.findOne({
        phone: userData.phone,
        tenantId: userData.tenantId,
      });
      if (existingUser) {
        console.log(`⏭️  Skipped user: ${userData.name} (already exists)`);
        sampleData.users.push(existingUser._id);
      } else {
        const user = new User(userData);
        await user.save();
        sampleData.users.push(user._id);
        console.log(`✅ Created user: ${user.name} (${user.phone})`);
      }
    }

    // 3. Create Families
    console.log('\n🏠 Creating families...');
    const familiesData = [
      {
        tenantId: sampleData.tenants[0],
        mahallId: 'KZM001-F001',
        houseName: 'Ali Villa',
        familyHead: 'Ahmed Ali',
        contactNo: '9876543210',
        wardNumber: 'Ward 1',
        houseNo: 'H-101',
        area: 'Area A',
        place: 'Kozhikode',
        state: 'Kerala',
        district: 'Kozhikode',
        pinCode: '673001',
        postOffice: 'Kozhikode',
        lsgName: 'Kozhikode Corporation',
        village: 'Kozhikode',
        varisangyaGrade: 'Grade A',
        status: 'approved' as const,
      },
      {
        tenantId: sampleData.tenants[0],
        mahallId: 'KZM001-F002',
        houseName: 'Khan House',
        familyHead: 'Ibrahim Khan',
        contactNo: '9876543213',
        wardNumber: 'Ward 2',
        houseNo: 'H-202',
        area: 'Area B',
        place: 'Kozhikode',
        state: 'Kerala',
        district: 'Kozhikode',
        pinCode: '673002',
        postOffice: 'Kozhikode',
        lsgName: 'Kozhikode Corporation',
        village: 'Kozhikode',
        varisangyaGrade: 'Grade B',
        status: 'approved' as const,
      },
      {
        tenantId: sampleData.tenants[0],
        mahallId: 'KZM001-F003',
        houseName: 'Rahman Residence',
        familyHead: 'Abdul Rahman',
        contactNo: '9876543214',
        wardNumber: 'Ward 1',
        houseNo: 'H-103',
        area: 'Area A',
        place: 'Kozhikode',
        state: 'Kerala',
        district: 'Kozhikode',
        pinCode: '673001',
        postOffice: 'Kozhikode',
        lsgName: 'Kozhikode Corporation',
        village: 'Kozhikode',
        varisangyaGrade: 'Grade C',
        status: 'pending' as const,
      },
      {
        tenantId: sampleData.tenants[1],
        mahallId: 'MLM001-F001',
        houseName: 'Malik Home',
        familyHead: 'Hassan Malik',
        contactNo: '9876543215',
        wardNumber: 'Ward 1',
        houseNo: 'H-301',
        area: 'Area A',
        place: 'Malappuram',
        state: 'Kerala',
        district: 'Malappuram',
        pinCode: '676001',
        postOffice: 'Malappuram',
        lsgName: 'Malappuram Municipality',
        village: 'Malappuram',
        varisangyaGrade: 'Grade A',
        status: 'approved' as const,
      },
    ];

    for (const familyData of familiesData) {
      const existingFamily = await Family.findOne({ mahallId: familyData.mahallId });
      if (existingFamily) {
        console.log(`⏭️  Skipped family: ${familyData.houseName} (already exists)`);
        sampleData.families.push(existingFamily._id);
      } else {
        const family = new Family(familyData);
        await family.save();
        sampleData.families.push(family._id);
        console.log(`✅ Created family: ${family.houseName} (${family.mahallId})`);
      }
    }

    // 4. Create Members
    console.log('\n👤 Creating members...');
    const membersData = [
      {
        tenantId: sampleData.tenants[0],
        mahallId: 'KZM001-M001',
        name: 'Ahmed Ali',
        familyId: sampleData.families[0],
        familyName: 'Ali Villa',
        age: 45,
        gender: 'male' as const,
        bloodGroup: 'O +ve',
        healthStatus: 'healthy',
        phone: '9876543210',
        education: 'Graduate',
      },
      {
        tenantId: sampleData.tenants[0],
        mahallId: 'KZM001-M002',
        name: 'Aisha Ali',
        familyId: sampleData.families[0],
        familyName: 'Ali Villa',
        age: 40,
        gender: 'female' as const,
        bloodGroup: 'A +ve',
        healthStatus: 'healthy',
        phone: '9876543216',
        education: 'Graduate',
      },
      {
        tenantId: sampleData.tenants[0],
        mahallId: 'KZM001-M003',
        name: 'Omar Ali',
        familyId: sampleData.families[0],
        familyName: 'Ali Villa',
        age: 18,
        gender: 'male' as const,
        bloodGroup: 'O +ve',
        healthStatus: 'healthy',
        education: 'Higher Secondary',
      },
      {
        tenantId: sampleData.tenants[0],
        mahallId: 'KZM001-M004',
        name: 'Ibrahim Khan',
        familyId: sampleData.families[1],
        familyName: 'Khan House',
        age: 50,
        gender: 'male' as const,
        bloodGroup: 'B +ve',
        healthStatus: 'healthy',
        phone: '9876543213',
        education: 'Post Graduate',
      },
      {
        tenantId: sampleData.tenants[0],
        mahallId: 'KZM001-M005',
        name: 'Fatima Khan',
        familyId: sampleData.families[1],
        familyName: 'Khan House',
        age: 45,
        gender: 'female' as const,
        bloodGroup: 'B +ve',
        healthStatus: 'healthy',
        phone: '9876543211',
        education: 'Graduate',
      },
      {
        tenantId: sampleData.tenants[1],
        mahallId: 'MLM001-M001',
        name: 'Hassan Malik',
        familyId: sampleData.families[3],
        familyName: 'Malik Home',
        age: 42,
        gender: 'male' as const,
        bloodGroup: 'A +ve',
        healthStatus: 'healthy',
        phone: '9876543215',
        education: 'Graduate',
      },
    ];

    for (const memberData of membersData) {
      const existingMember = await Member.findOne({ mahallId: memberData.mahallId });
      if (existingMember) {
        console.log(`⏭️  Skipped member: ${memberData.name} (already exists)`);
        sampleData.members.push(existingMember._id);
      } else {
        const member = new Member(memberData);
        await member.save();
        sampleData.members.push(member._id);
        console.log(`✅ Created member: ${member.name} (${member.mahallId})`);
      }
    }

    // 5. Create Institutes
    console.log('\n🏛️ Creating institutes...');
    const institutesData = [
      {
        tenantId: sampleData.tenants[0],
        name: 'Al-Azhar Islamic Center',
        place: 'Kozhikode',
        type: 'institute' as const,
        joinDate: new Date('2023-01-15'),
        description: 'Islamic educational institute',
        contactNo: '04951234567',
        email: 'alazhar@mahallu.com',
        address: {
          state: 'Kerala',
          district: 'Kozhikode',
          pinCode: '673001',
          postOffice: 'Kozhikode',
        },
        status: 'active' as const,
      },
      {
        tenantId: sampleData.tenants[0],
        name: 'Quran Learning Program',
        place: 'Kozhikode',
        type: 'program' as const,
        joinDate: new Date('2023-02-01'),
        description: 'Quran memorization program',
        contactNo: '04951234568',
        status: 'active' as const,
      },
      {
        tenantId: sampleData.tenants[0],
        name: 'Darul Uloom Madrasa',
        place: 'Kozhikode',
        type: 'madrasa' as const,
        joinDate: new Date('2023-03-01'),
        description: 'Traditional Islamic school',
        contactNo: '04951234569',
        status: 'active' as const,
      },
    ];

    for (const instituteData of institutesData) {
      const existingInstitute = await Institute.findOne({
        name: instituteData.name,
        tenantId: instituteData.tenantId,
      });
      if (existingInstitute) {
        console.log(`⏭️  Skipped institute: ${instituteData.name} (already exists)`);
        sampleData.institutes.push(existingInstitute._id);
      } else {
        const institute = new Institute(instituteData);
        await institute.save();
        sampleData.institutes.push(institute._id);
        console.log(`✅ Created institute: ${institute.name}`);
      }
    }

    // 6. Create Committees
    console.log('\n👥 Creating committees...');
    const committeesData = [
      {
        tenantId: sampleData.tenants[0],
        name: 'Executive Committee',
        description: 'Main executive committee',
        members: [sampleData.members[0], sampleData.members[3]],
        status: 'active' as const,
      },
      {
        tenantId: sampleData.tenants[0],
        name: 'Education Committee',
        description: 'Manages educational activities',
        members: [sampleData.members[1], sampleData.members[4]],
        status: 'active' as const,
      },
    ];

    for (const committeeData of committeesData) {
      const existingCommittee = await Committee.findOne({
        name: committeeData.name,
        tenantId: committeeData.tenantId,
      });
      if (existingCommittee) {
        console.log(`⏭️  Skipped committee: ${committeeData.name} (already exists)`);
        sampleData.committees.push(existingCommittee._id);
      } else {
        const committee = new Committee(committeeData);
        await committee.save();
        sampleData.committees.push(committee._id);
        console.log(`✅ Created committee: ${committee.name}`);
      }
    }

    // 7. Create Varisangya Payments
    console.log('\n💰 Creating varisangya payments...');
    const varisangyaData = [
      {
        tenantId: sampleData.tenants[0],
        familyId: sampleData.families[0],
        memberId: sampleData.members[0],
        amount: 100,
        paymentDate: new Date(),
        paymentMethod: 'Cash',
        receiptNo: 'VAR001',
        remarks: 'Monthly payment',
      },
      {
        tenantId: sampleData.tenants[0],
        familyId: sampleData.families[1],
        memberId: sampleData.members[3],
        amount: 100,
        paymentDate: new Date(),
        paymentMethod: 'Online',
        receiptNo: 'VAR002',
        remarks: 'Monthly payment',
      },
    ];

    for (const varisangyaItem of varisangyaData) {
      const existing = await Varisangya.findOne({ receiptNo: varisangyaItem.receiptNo });
      if (!existing) {
        const varisangya = new Varisangya(varisangyaItem);
        await varisangya.save();
        console.log(`✅ Created varisangya payment: ${varisangya.receiptNo}`);
      }
    }

    // 8. Create Zakat Payments
    console.log('\n💵 Creating zakat payments...');
    const zakatData = [
      {
        tenantId: sampleData.tenants[0],
        payerName: 'Ahmed Ali',
        payerId: sampleData.members[0],
        amount: 5000,
        paymentDate: new Date(),
        paymentMethod: 'Online',
        receiptNo: 'ZAK001',
        category: 'Zakat al-Mal',
        remarks: 'Annual zakat payment',
      },
      {
        tenantId: sampleData.tenants[0],
        payerName: 'Ibrahim Khan',
        payerId: sampleData.members[3],
        amount: 3000,
        paymentDate: new Date(),
        paymentMethod: 'Cash',
        receiptNo: 'ZAK002',
        category: 'Zakat al-Mal',
        remarks: 'Annual zakat payment',
      },
    ];

    for (const zakatItem of zakatData) {
      const existing = await Zakat.findOne({ receiptNo: zakatItem.receiptNo });
      if (!existing) {
        const zakat = new Zakat(zakatItem);
        await zakat.save();
        console.log(`✅ Created zakat payment: ${zakat.receiptNo}`);
      }
    }

    // 9. Create Registrations
    console.log('\n📋 Creating registrations...');
    const nikahData = {
      tenantId: sampleData.tenants[0],
      groomName: 'Omar Ali',
      groomAge: 25,
      groomId: sampleData.members[2],
      brideName: 'Zainab Rahman',
      brideAge: 22,
      nikahDate: new Date('2024-01-15'),
      mahallId: 'KZM001',
      waliName: 'Ahmed Ali',
      witness1: 'Ibrahim Khan',
      witness2: 'Hassan Malik',
      mahrAmount: 50000,
      mahrDescription: 'Gold and cash',
      status: 'pending' as const,
    };

    const existingNikah = await NikahRegistration.findOne({
      groomName: nikahData.groomName,
      brideName: nikahData.brideName,
    });
    if (!existingNikah) {
      const nikah = new NikahRegistration(nikahData);
      await nikah.save();
      console.log(`✅ Created nikah registration: ${nikah.groomName} & ${nikah.brideName}`);
    }

    const deathData = {
      tenantId: sampleData.tenants[0],
      deceasedName: 'Abdul Rahman',
      deathDate: new Date('2023-12-01'),
      placeOfDeath: 'Kozhikode',
      causeOfDeath: 'Natural',
      mahallId: 'KZM001',
      familyId: sampleData.families[2],
      informantName: 'Mohammed Rahman',
      informantRelation: 'Son',
      informantPhone: '9876543217',
      status: 'approved' as const,
    };

    const existingDeath = await DeathRegistration.findOne({
      deceasedName: deathData.deceasedName,
    });
    if (!existingDeath) {
      const death = new DeathRegistration(deathData);
      await death.save();
      console.log(`✅ Created death registration: ${death.deceasedName}`);
    }

    const nocData = {
      tenantId: sampleData.tenants[0],
      applicantName: 'Ahmed Ali',
      applicantId: sampleData.members[0],
      applicantPhone: '9876543210',
      purpose: 'Travel abroad',
      type: 'common' as const,
      status: 'pending' as const,
    };

    const existingNOC = await NOC.findOne({
      applicantName: nocData.applicantName,
      purpose: nocData.purpose,
    });
    if (!existingNOC) {
      const noc = new NOC(nocData);
      await noc.save();
      console.log(`✅ Created NOC: ${noc.applicantName}`);
    }

    // 10. Create Meetings
    console.log('\n📅 Creating meetings...');
    const meetingData = {
      tenantId: sampleData.tenants[0],
      committeeId: sampleData.committees[0],
      title: 'Monthly Executive Meeting',
      meetingDate: new Date('2024-01-20'),
      attendance: [sampleData.members[0], sampleData.members[3]],
      totalMembers: 2,
      attendancePercent: 100,
      agenda: 'Budget review, Upcoming events, Member updates',
      status: 'scheduled' as const,
    };

    const existingMeeting = await Meeting.findOne({
      title: meetingData.title,
      meetingDate: meetingData.meetingDate,
    });
    if (!existingMeeting) {
      const meeting = new Meeting(meetingData);
      await meeting.save();
      console.log(`✅ Created meeting: ${meeting.title}`);
    }

    console.log('\n📊 Summary:');
    console.log(`   Tenants: ${sampleData.tenants.length}`);
    console.log(`   Users: ${sampleData.users.length}`);
    console.log(`   Families: ${sampleData.families.length}`);
    console.log(`   Members: ${sampleData.members.length}`);
    console.log(`   Institutes: ${sampleData.institutes.length}`);
    console.log(`   Committees: ${sampleData.committees.length}`);
    console.log('\n✅ Sample data insertion completed!\n');
    console.log('🔑 Default password for all users: 123456');
    console.log('📱 OTP login is enabled - use phone number to receive OTP\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

insertSampleData();

