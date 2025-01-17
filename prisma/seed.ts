import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  // Clear all data in reverse order of dependencies
  await prisma.reaction.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.channelMember.deleteMany({});
  await prisma.channel.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('Database cleared');
}

async function createUsers() {
  const users = await prisma.user.createMany({
    data: [
      { id: 'user_001', name: 'Orlando' },
      { id: 'user_002', name: 'Paul' },
      { id: 'user_003', name: 'Stringer' },
      { id: 'user_004', name: 'Marlo' },
      { id: 'test_user_1', name: 'Test User 1' },
      { id: 'test_user_2', name: 'Test User 2' }
    ],
  });
  console.log('Users created');
  return users;
}

async function createChannels() {
  const channels = await prisma.channel.createMany({
    data: [
      { id: 'channel_001', name: 'basketball', createdById: 'user_001' },
      { id: 'channel_002', name: 'rap', createdById: 'user_002' },
      { id: 'channel_003', name: 'boxing', createdById: 'user_003' },
      { id: 'test_channel', name: 'Test Channel', createdById: 'test_user_1' }
    ],
  });
  console.log('Channels created');
  return channels;
}

async function associateMembers() {
  // Add all users to all channels
  const users = ['user_001', 'user_002', 'user_003', 'user_004', 'test_user_1', 'test_user_2'];
  const channels = ['channel_001', 'channel_002', 'channel_003', 'test_channel'];
  
  type MembershipData = {
    userId: string;
    channelId: string;
    role: 'OWNER' | 'MEMBER';
  };

  const membershipData: MembershipData[] = [];
  for (const userId of users) {
    for (const channelId of channels) {
      membershipData.push({
        userId,
        channelId,
        role: 'MEMBER',
      });
    }
  }

  // Set channel creators as OWNER
  const setOwner = (userId: string, channelId: string) => {
    const membership = membershipData.find(m => m.userId === userId && m.channelId === channelId);
    if (membership) {
      membership.role = 'OWNER';
    }
  };

  setOwner('user_001', 'channel_001');
  setOwner('user_002', 'channel_002');
  setOwner('user_003', 'channel_003');
  setOwner('test_user_1', 'test_channel');

  await prisma.channelMember.createMany({
    data: membershipData,
  });
  console.log('Channel memberships created');
}

async function createMessages() {
  const userMessages = [
    // Basketball threads
    { userId: 'user_001', channelId: 'channel_001', content: "Basketball is life!" },
    { userId: 'user_002', channelId: 'channel_001', content: "LeBron is the GOAT.", replyToId: 'msg_001' },
    { userId: 'user_003', channelId: 'channel_001', content: "Curry changed the game.", replyToId: 'msg_001' },
    { userId: 'user_004', channelId: 'channel_001', content: "The 90s Bulls were unstoppable.", replyToId: 'msg_001' },

    // NBA Defense Thread
    { userId: 'user_001', channelId: 'channel_001', content: "The NBA needs more defense." },
    { userId: 'user_002', channelId: 'channel_001', content: "Basketball is too commercialized now.", replyToId: 'msg_005' },
    { userId: 'user_003', channelId: 'channel_001', content: "The NBA is too focused on offense.", replyToId: 'msg_005' },
    { userId: 'user_004', channelId: 'channel_001', content: "The NBA should have a shorter season.", replyToId: 'msg_005' },

    // LeBron vs MJ Thread
    { userId: 'user_001', channelId: 'channel_001', content: "LeBron vs. MJ debates are endless." },
    { userId: 'user_002', channelId: 'channel_001', content: "LeBron is overrated, just a stat-padder.", replyToId: 'msg_009' },
    { userId: 'user_003', channelId: 'channel_001', content: "MJ wouldn't survive in today's NBA.", replyToId: 'msg_009' },
    { userId: 'user_004', channelId: 'channel_001', content: "Different eras, can't compare.", replyToId: 'msg_009' },

    // Lakers Thread
    { userId: 'user_002', channelId: 'channel_001', content: "The Lakers are the best franchise." },
    { userId: 'user_003', channelId: 'channel_001', content: "The Celtics' history is rich.", replyToId: 'msg_013' },
    { userId: 'user_004', channelId: 'channel_001', content: "The Knicks need a championship.", replyToId: 'msg_013' },

    // Rap Evolution Thread
    { userId: 'user_001', channelId: 'channel_002', content: "90s rap had the best beats." },
    { userId: 'user_002', channelId: 'channel_002', content: "Old school rap had more substance.", replyToId: 'msg_016' },
    { userId: 'user_003', channelId: 'channel_002', content: "Modern rap is different but still good.", replyToId: 'msg_016' },
    { userId: 'user_004', channelId: 'channel_002', content: "Each era has its own style.", replyToId: 'msg_016' },

    // Kendrick Thread
    { userId: 'user_001', channelId: 'channel_002', content: "Kendrick Lamar is a lyrical genius." },
    { userId: 'user_002', channelId: 'channel_002', content: "His storytelling is unmatched!", replyToId: 'msg_020' },
    { userId: 'user_003', channelId: 'channel_002', content: "TPAB was a masterpiece.", replyToId: 'msg_020' },

    // Modern Rap Criticism Thread
    { userId: 'user_001', channelId: 'channel_002', content: "Auto-tune ruined rap music." },
    { userId: 'user_002', channelId: 'channel_002', content: "Modern rap is just noise, no substance.", replyToId: 'msg_023' },
    { userId: 'user_003', channelId: 'channel_002', content: "Rap needs more storytelling.", replyToId: 'msg_023' },
    { userId: 'user_004', channelId: 'channel_002', content: "Rap needs more diversity.", replyToId: 'msg_023' },

    // Boxing Legends Thread
    { userId: 'user_001', channelId: 'channel_003', content: "Ali was the greatest." },
    { userId: 'user_002', channelId: 'channel_003', content: "Tyson was a beast in his prime.", replyToId: 'msg_027' },
    { userId: 'user_003', channelId: 'channel_003', content: "His peak was incredible.", replyToId: 'msg_028' },
    { userId: 'user_004', channelId: 'channel_003', content: "Boxing needs more personalities like him.", replyToId: 'msg_028' },

    // Modern Boxing Thread
    { userId: 'user_001', channelId: 'channel_003', content: "Mayweather's defense was art." },
    { userId: 'user_002', channelId: 'channel_003', content: "Mayweather is boring, just runs around.", replyToId: 'msg_031' },
    { userId: 'user_003', channelId: 'channel_003', content: "Boxing needs more drama, less politics.", replyToId: 'msg_031' },
    { userId: 'user_004', channelId: 'channel_003', content: "Boxing needs more innovation.", replyToId: 'msg_031' },

    // Boxing Future Thread
    { userId: 'user_001', channelId: 'channel_003', content: "Boxing is dead, MMA is the future." },
    { userId: 'user_002', channelId: 'channel_003', content: "Boxing needs a unified champion.", replyToId: 'msg_035' },
    { userId: 'user_003', channelId: 'channel_003', content: "The heavyweight division needs more stars.", replyToId: 'msg_035' },
    { userId: 'user_004', channelId: 'channel_003', content: "Boxing needs more global stars.", replyToId: 'msg_035' },

    // Continue with remaining messages without thread relationships
    { userId: 'user_001', channelId: 'channel_001', content: "Durant's scoring ability is unmatched." },
    { userId: 'user_001', channelId: 'channel_001', content: "The NBA draft is always exciting." },
    { userId: 'user_001', channelId: 'channel_001', content: "The dunk contest needs more stars." },
    { userId: 'user_001', channelId: 'channel_001', content: "The NBA bubble was a unique experience." },
    { userId: 'user_001', channelId: 'channel_001', content: "The Warriors' dynasty was impressive." },
    { userId: 'user_001', channelId: 'channel_002', content: "Drake's versatility is impressive." },
    { userId: 'user_001', channelId: 'channel_002', content: "Jay-Z's business acumen is inspiring." },
    { userId: 'user_001', channelId: 'channel_002', content: "Nas's storytelling is legendary." },
    { userId: 'user_001', channelId: 'channel_002', content: "Tupac's impact goes beyond music." },
    { userId: 'user_001', channelId: 'channel_002', content: "Biggie's flow was smooth as butter." },
    { userId: 'user_001', channelId: 'channel_003', content: "Canelo's technique is flawless." },
    { userId: 'user_001', channelId: 'channel_003', content: "Fury's comeback story is inspiring." },
    { userId: 'user_001', channelId: 'channel_003', content: "The sweet science is all about strategy." },

    // Add DevOps/Kubernetes messages
    { userId: 'test_user_1', channelId: 'test_channel', content: "Our deployment process uses Docker containers orchestrated with Kubernetes. The pipeline goes through dev, staging, and prod environments." },
    { userId: 'test_user_2', channelId: 'test_channel', content: "For local development, you can use minikube. First, install it using brew install minikube, then start it with minikube start." },
    { userId: 'test_user_1', channelId: 'test_channel', content: "We use GitHub Actions for CI/CD. Every PR triggers tests and builds a new container image." },
    { userId: 'test_user_2', channelId: 'test_channel', content: "I'm getting a 503 error in production after the latest deployment. Any ideas?" },
    { userId: 'test_user_1', channelId: 'test_channel', content: "Check the pod logs. Might be a memory issue. Run kubectl logs <pod-name> to investigate." },
    { userId: 'test_user_2', channelId: 'test_channel', content: "Found the issue - one of our services was OOMKilled. We need to increase the memory limit in the deployment yaml." },
    { userId: 'test_user_1', channelId: 'test_channel', content: "We should add rate limiting to our API endpoints. Getting too many requests in prod." },
    { userId: 'test_user_2', channelId: 'test_channel', content: "Good idea. We can use Redis for rate limiting. Here's a simple implementation using the rate-limiter-flexible package: [code example]" },
    { userId: 'test_user_1', channelId: 'test_channel', content: "Let's also add retry logic with exponential backoff for failed requests." },

    // Add help/documentation messages
    { userId: 'test_user_1', channelId: 'test_channel', content: "To reset your password, go to Settings > Security and click on 'Reset Password'. Follow the email instructions." },
    { userId: 'test_user_2', channelId: 'test_channel', content: "Channel permissions can be managed by admins and moderators. Go to Channel Settings > Permissions to modify roles." },
    { userId: 'test_user_1', channelId: 'test_channel', content: "To create a new thread, click the '+' button in any channel and select 'New Thread'. Add a title and description." },
    { userId: 'test_user_2', channelId: 'test_channel', content: "For enhanced security, we recommend enabling two-factor authentication in your account settings." },
    { userId: 'test_user_1', channelId: 'test_channel', content: "You can customize your notification settings per channel by clicking the channel settings gear icon." },

    // Add Drake facts and opinions
    { userId: 'test_user_1', channelId: 'channel_002', content: "Views was released on April 29, 2016 and debuted at number one on the Billboard 200." },
    { userId: 'test_user_2', channelId: 'channel_002', content: "Scorpion broke streaming records with over 1 billion streams in its first week of release." },
    { userId: 'test_user_1', channelId: 'channel_002', content: "Drake has won 4 Grammy Awards from 47 nominations throughout his career." },
    { userId: 'test_user_2', channelId: 'channel_002', content: "Drake became the first artist to surpass 50 billion streams on Spotify in 2021." },
    { userId: 'test_user_1', channelId: 'channel_002', content: "Drake holds the record for most Billboard Hot 100 entries ever with over 250 songs charting." },
    { userId: 'test_user_2', channelId: 'channel_002', content: "Drake revolutionized hip-hop by seamlessly switching between melodic singing and technical rapping." },
    { userId: 'test_user_1', channelId: 'channel_002', content: "Drake changed rap by making emotional vulnerability and personal relationships central themes." }
  ];

  // Create all messages with their relationships
  let messageId = 1;
  for (const message of userMessages) {
    const id = `msg_${messageId.toString().padStart(3, '0')}`;
    await prisma.message.create({
      data: {
        id,
        content: message.content,
        channelId: message.channelId,
        userId: message.userId,
        replyToId: message.replyToId
      },
    });
    messageId++;
  }
  
  console.log('Messages created');
}

async function main() {
  try {
    await clearDatabase();
    await createUsers();
    await createChannels();
    await associateMembers();
    await createMessages();
    
    console.log('Seed completed successfully');
  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 