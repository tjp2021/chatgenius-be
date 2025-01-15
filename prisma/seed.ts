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
    ],
  });
  console.log('Channels created');
  return channels;
}

async function associateMembers() {
  // Add all users to all channels
  const users = ['user_001', 'user_002', 'user_003', 'user_004'];
  const channels = ['channel_001', 'channel_002', 'channel_003'];
  
  const membershipData = [];
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
  membershipData.find(m => m.userId === 'user_001' && m.channelId === 'channel_001').role = 'OWNER';
  membershipData.find(m => m.userId === 'user_002' && m.channelId === 'channel_002').role = 'OWNER';
  membershipData.find(m => m.userId === 'user_003' && m.channelId === 'channel_003').role = 'OWNER';

  await prisma.channelMember.createMany({
    data: membershipData,
  });
  console.log('Channel memberships created');
}

async function createMessages() {
  // Define all messages
  const userMessages = [
    { userId: 'user_001', channelId: 'channel_001', content: "Basketball is life!" },
    { userId: 'user_001', channelId: 'channel_001', content: "The NBA needs more defense." },
    { userId: 'user_001', channelId: 'channel_001', content: "Who remembers the 90s Bulls?" },
    { userId: 'user_001', channelId: 'channel_001', content: "LeBron vs. MJ debates are endless." },
    { userId: 'user_001', channelId: 'channel_001', content: "Steph Curry changed the game." },
    { userId: 'user_001', channelId: 'channel_001', content: "Kobe's work ethic was unmatched." },
    { userId: 'user_001', channelId: 'channel_001', content: "Shaq was a dominant force." },
    { userId: 'user_001', channelId: 'channel_001', content: "The 3-point line should be moved back." },
    { userId: 'user_001', channelId: 'channel_001', content: "Giannis is a freak of nature." },
    { userId: 'user_001', channelId: 'channel_001', content: "The All-Star game needs more competition." },
    { userId: 'user_001', channelId: 'channel_001', content: "Basketball was better without the 3-point line." },
    { userId: 'user_001', channelId: 'channel_001', content: "The NBA should allow more physical play." },
    { userId: 'user_001', channelId: 'channel_001', content: "LeBron is overrated, just a stat-padder." },
    { userId: 'user_001', channelId: 'channel_001', content: "MJ wouldn't survive in today's NBA." },
    { userId: 'user_001', channelId: 'channel_001', content: "The NBA is too soft now." },
    { userId: 'user_001', channelId: 'channel_002', content: "Rap is poetry in motion." },
    { userId: 'user_001', channelId: 'channel_002', content: "Kendrick Lamar is a lyrical genius." },
    { userId: 'user_001', channelId: 'channel_002', content: "90s rap had the best beats." },
    { userId: 'user_001', channelId: 'channel_002', content: "Eminem's wordplay is unmatched." },
    { userId: 'user_001', channelId: 'channel_002', content: "Drake's versatility is impressive." },
    { userId: 'user_001', channelId: 'channel_002', content: "Jay-Z's business acumen is inspiring." },
    { userId: 'user_001', channelId: 'channel_002', content: "Nas's storytelling is legendary." },
    { userId: 'user_001', channelId: 'channel_002', content: "Tupac's impact goes beyond music." },
    { userId: 'user_001', channelId: 'channel_002', content: "Biggie's flow was smooth as butter." },
    { userId: 'user_001', channelId: 'channel_002', content: "Lil Wayne's influence is undeniable." },
    { userId: 'user_001', channelId: 'channel_002', content: "The East Coast vs. West Coast rivalry was intense." },
    { userId: 'user_001', channelId: 'channel_002', content: "Modern rap is just noise, no substance." },
    { userId: 'user_001', channelId: 'channel_002', content: "Auto-tune ruined rap music." },
    { userId: 'user_001', channelId: 'channel_002', content: "Drake is just a pop star, not a real rapper." },
    { userId: 'user_001', channelId: 'channel_002', content: "Rap needs more storytelling, less mumbling." },
    { userId: 'user_001', channelId: 'channel_003', content: "Boxing is the ultimate test of skill." },
    { userId: 'user_001', channelId: 'channel_003', content: "Ali was the greatest." },
    { userId: 'user_001', channelId: 'channel_003', content: "Tyson's power was legendary." },
    { userId: 'user_001', channelId: 'channel_003', content: "Mayweather's defense was art." },
    { userId: 'user_001', channelId: 'channel_003', content: "The heavyweight division needs more stars." },
    { userId: 'user_001', channelId: 'channel_003', content: "Pacquiao's speed was incredible." },
    { userId: 'user_001', channelId: 'channel_003', content: "Canelo's technique is flawless." },
    { userId: 'user_001', channelId: 'channel_003', content: "Fury's comeback story is inspiring." },
    { userId: 'user_001', channelId: 'channel_003', content: "The sweet science is all about strategy." },
    { userId: 'user_001', channelId: 'channel_003', content: "Boxing needs a unified champion." },
    { userId: 'user_001', channelId: 'channel_003', content: "Boxing is dead, MMA is the future." },
    { userId: 'user_001', channelId: 'channel_003', content: "Mayweather is boring, just runs around." },
    { userId: 'user_001', channelId: 'channel_003', content: "Tyson would destroy any modern heavyweight." },
    { userId: 'user_001', channelId: 'channel_003', content: "Boxing needs more knockouts, less dancing." },
    { userId: 'user_002', channelId: 'channel_001', content: "LeBron is the GOAT." },
    { userId: 'user_002', channelId: 'channel_001', content: "The Lakers are the best franchise." },
    { userId: 'user_002', channelId: 'channel_001', content: "Durant's scoring ability is unmatched." },
    { userId: 'user_002', channelId: 'channel_001', content: "The NBA draft is always exciting." },
    { userId: 'user_002', channelId: 'channel_001', content: "The dunk contest needs more stars." },
    { userId: 'user_002', channelId: 'channel_001', content: "The NBA bubble was a unique experience." },
    { userId: 'user_002', channelId: 'channel_001', content: "The Warriors' dynasty was impressive." },
    { userId: 'user_002', channelId: 'channel_001', content: "The Knicks need a championship." },
    { userId: 'user_002', channelId: 'channel_001', content: "The Celtics' history is rich." },
    { userId: 'user_002', channelId: 'channel_001', content: "The NBA needs more international stars." },
    { userId: 'user_002', channelId: 'channel_001', content: "Basketball is too commercialized now." },
    { userId: 'user_002', channelId: 'channel_001', content: "The NBA should have a 4-point line." },
    { userId: 'user_002', channelId: 'channel_001', content: "LeBron is just chasing stats, not rings." },
    { userId: 'user_002', channelId: 'channel_001', content: "The NBA is rigged for big markets." },
    { userId: 'user_002', channelId: 'channel_001', content: "The NBA needs more rivalries." },
    { userId: 'user_002', channelId: 'channel_002', content: "90s rap was the golden era." },
    { userId: 'user_002', channelId: 'channel_002', content: "Ali was the greatest." },
    { userId: 'user_002', channelId: 'channel_002', content: "The East Coast vs. West Coast rivalry was intense." },
    { userId: 'user_002', channelId: 'channel_002', content: "Snoop Dogg's style is iconic." },
    { userId: 'user_002', channelId: 'channel_002', content: "Ice Cube's impact on rap is huge." },
    { userId: 'user_002', channelId: 'channel_002', content: "The Notorious B.I.G. was a legend." },
    { userId: 'user_002', channelId: 'channel_002', content: "Wu-Tang Clan ain't nothin' to mess with." },
    { userId: 'user_002', channelId: 'channel_002', content: "Public Enemy's message was powerful." },
    { userId: 'user_002', channelId: 'channel_002', content: "Run-D.M.C. paved the way for many." },
    { userId: 'user_002', channelId: 'channel_002', content: "LL Cool J is a pioneer." },
    { userId: 'user_002', channelId: 'channel_002', content: "Rap is too focused on money now." },
    { userId: 'user_002', channelId: 'channel_002', content: "Old school rap had more substance." },
    { userId: 'user_002', channelId: 'channel_002', content: "Rap needs more conscious lyrics." },
    { userId: 'user_002', channelId: 'channel_002', content: "The rap game is too saturated." },
    { userId: 'user_002', channelId: 'channel_002', content: "Rap battles should be more mainstream." },
    { userId: 'user_002', channelId: 'channel_003', content: "Ali was the greatest." },
    { userId: 'user_002', channelId: 'channel_003', content: "The heavyweight division needs more stars." },
    { userId: 'user_002', channelId: 'channel_003', content: "The sweet science is all about strategy." },
    { userId: 'user_002', channelId: 'channel_003', content: "Boxing needs a unified champion." },
    { userId: 'user_002', channelId: 'channel_003', content: "The heavyweight division needs more stars." },
    { userId: 'user_002', channelId: 'channel_003', content: "Pacquiao's speed was incredible." },
    { userId: 'user_002', channelId: 'channel_003', content: "Canelo's technique is flawless." },
    { userId: 'user_002', channelId: 'channel_003', content: "Fury's comeback story is inspiring." },
    { userId: 'user_002', channelId: 'channel_003', content: "The sweet science is all about strategy." },
    { userId: 'user_002', channelId: 'channel_003', content: "Boxing needs a unified champion." },
    { userId: 'user_002', channelId: 'channel_003', content: "Boxing is too corrupt now." },
    { userId: 'user_002', channelId: 'channel_003', content: "MMA is more exciting than boxing." },
    { userId: 'user_002', channelId: 'channel_003', content: "Boxing needs more personalities." },
    { userId: 'user_002', channelId: 'channel_003', content: "Boxing should have fewer weight classes." },
    { userId: 'user_002', channelId: 'channel_003', content: "Boxing needs more global stars." },
    { userId: 'user_003', channelId: 'channel_001', content: "Curry changed the game." },
    { userId: 'user_003', channelId: 'channel_001', content: "The NBA needs more defense." },
    { userId: 'user_003', channelId: 'channel_001', content: "Who remembers the 90s Bulls?" },
    { userId: 'user_003', channelId: 'channel_001', content: "LeBron vs. MJ debates are endless." },
    { userId: 'user_003', channelId: 'channel_001', content: "Steph Curry changed the game." },
    { userId: 'user_003', channelId: 'channel_001', content: "Kobe's work ethic was unmatched." },
    { userId: 'user_003', channelId: 'channel_001', content: "Shaq was a dominant force." },
    { userId: 'user_003', channelId: 'channel_001', content: "The 3-point line should be moved back." },
    { userId: 'user_003', channelId: 'channel_001', content: "Giannis is a freak of nature." },
    { userId: 'user_003', channelId: 'channel_001', content: "The All-Star game needs more competition." },
    { userId: 'user_003', channelId: 'channel_001', content: "The NBA is too focused on offense." },
    { userId: 'user_003', channelId: 'channel_001', content: "The NBA should have a mid-season tournament." },
    { userId: 'user_003', channelId: 'channel_001', content: "The NBA needs more international games." },
    { userId: 'user_003', channelId: 'channel_001', content: "The NBA should have a shorter season." },
    { userId: 'user_003', channelId: 'channel_001', content: "The NBA needs more diversity in coaching." },
    { userId: 'user_003', channelId: 'channel_002', content: "Kendrick's lyrics are unmatched." },
    { userId: 'user_003', channelId: 'channel_002', content: "90s rap had the best beats." },
    { userId: 'user_003', channelId: 'channel_002', content: "Eminem's wordplay is unmatched." },
    { userId: 'user_003', channelId: 'channel_002', content: "Drake's versatility is impressive." },
    { userId: 'user_003', channelId: 'channel_002', content: "Jay-Z's business acumen is inspiring." },
    { userId: 'user_003', channelId: 'channel_002', content: "Nas's storytelling is legendary." },
    { userId: 'user_003', channelId: 'channel_002', content: "Tupac's impact goes beyond music." },
    { userId: 'user_003', channelId: 'channel_002', content: "Biggie's flow was smooth as butter." },
    { userId: 'user_003', channelId: 'channel_002', content: "Lil Wayne's influence is undeniable." },
    { userId: 'user_003', channelId: 'channel_002', content: "The East Coast vs. West Coast rivalry was intense." },
    { userId: 'user_003', channelId: 'channel_002', content: "Rap needs more female voices." },
    { userId: 'user_003', channelId: 'channel_002', content: "Rap is too focused on materialism." },
    { userId: 'user_003', channelId: 'channel_002', content: "Rap needs more live instruments." },
    { userId: 'user_003', channelId: 'channel_002', content: "Rap needs more collaborations." },
    { userId: 'user_003', channelId: 'channel_002', content: "Rap needs more storytelling." },
    { userId: 'user_003', channelId: 'channel_003', content: "Tyson was a beast in his prime." },
    { userId: 'user_003', channelId: 'channel_003', content: "Mayweather's defense was art." },
    { userId: 'user_003', channelId: 'channel_003', content: "The heavyweight division needs more stars." },
    { userId: 'user_003', channelId: 'channel_003', content: "Pacquiao's speed was incredible." },
    { userId: 'user_003', channelId: 'channel_003', content: "Canelo's technique is flawless." },
    { userId: 'user_003', channelId: 'channel_003', content: "Fury's comeback story is inspiring." },
    { userId: 'user_003', channelId: 'channel_003', content: "The sweet science is all about strategy." },
    { userId: 'user_003', channelId: 'channel_003', content: "Boxing needs a unified champion." },
    { userId: 'user_003', channelId: 'channel_003', content: "The heavyweight division needs more stars." },
    { userId: 'user_003', channelId: 'channel_003', content: "Pacquiao's speed was incredible." },
    { userId: 'user_003', channelId: 'channel_003', content: "Boxing needs more drama, less politics." },
    { userId: 'user_003', channelId: 'channel_003', content: "Boxing needs more rivalries." },
    { userId: 'user_003', channelId: 'channel_003', content: "Boxing needs more transparency." },
    { userId: 'user_003', channelId: 'channel_003', content: "Boxing needs more innovation." },
    { userId: 'user_003', channelId: 'channel_003', content: "Boxing needs more excitement." },
    { userId: 'user_004', channelId: 'channel_001', content: "The 90s Bulls were unstoppable." },
    { userId: 'user_004', channelId: 'channel_001', content: "Drake's influence is undeniable." },
    { userId: 'user_004', channelId: 'channel_001', content: "Mayweather's defense was art." },
    { userId: 'user_004', channelId: 'channel_001', content: "The NBA needs more defense." },
    { userId: 'user_004', channelId: 'channel_001', content: "Who remembers the 90s Bulls?" },
    { userId: 'user_004', channelId: 'channel_001', content: "LeBron vs. MJ debates are endless." },
    { userId: 'user_004', channelId: 'channel_001', content: "Steph Curry changed the game." },
    { userId: 'user_004', channelId: 'channel_001', content: "Kobe's work ethic was unmatched." },
    { userId: 'user_004', channelId: 'channel_001', content: "Shaq was a dominant force." },
    { userId: 'user_004', channelId: 'channel_001', content: "The 3-point line should be moved back." },
    { userId: 'user_004', channelId: 'channel_001', content: "The NBA needs more personalities." },
    { userId: 'user_004', channelId: 'channel_001', content: "The NBA needs more rivalries." },
    { userId: 'user_004', channelId: 'channel_001', content: "The NBA needs more excitement." },
    { userId: 'user_004', channelId: 'channel_001', content: "The NBA needs more innovation." },
    { userId: 'user_004', channelId: 'channel_001', content: "The NBA needs more transparency." },
    { userId: 'user_004', channelId: 'channel_002', content: "Drake's influence is undeniable." },
    { userId: 'user_004', channelId: 'channel_002', content: "Mayweather's defense was art." },
    { userId: 'user_004', channelId: 'channel_002', content: "The NBA needs more defense." },
    { userId: 'user_004', channelId: 'channel_002', content: "Who remembers the 90s Bulls?" },
    { userId: 'user_004', channelId: 'channel_002', content: "LeBron vs. MJ debates are endless." },
    { userId: 'user_004', channelId: 'channel_002', content: "Steph Curry changed the game." },
    { userId: 'user_004', channelId: 'channel_002', content: "Kobe's work ethic was unmatched." },
    { userId: 'user_004', channelId: 'channel_002', content: "Shaq was a dominant force." },
    { userId: 'user_004', channelId: 'channel_002', content: "The 3-point line should be moved back." },
    { userId: 'user_004', channelId: 'channel_002', content: "Giannis is a freak of nature." },
    { userId: 'user_004', channelId: 'channel_002', content: "Rap needs more diversity." },
    { userId: 'user_004', channelId: 'channel_002', content: "Rap needs more excitement." },
    { userId: 'user_004', channelId: 'channel_002', content: "Rap needs more innovation." },
    { userId: 'user_004', channelId: 'channel_002', content: "Rap needs more transparency." },
    { userId: 'user_004', channelId: 'channel_002', content: "Rap needs more rivalries." },
    { userId: 'user_004', channelId: 'channel_003', content: "Mayweather's defense was art." },
    { userId: 'user_004', channelId: 'channel_003', content: "The NBA needs more defense." },
    { userId: 'user_004', channelId: 'channel_003', content: "Who remembers the 90s Bulls?" },
    { userId: 'user_004', channelId: 'channel_003', content: "LeBron vs. MJ debates are endless." },
    { userId: 'user_004', channelId: 'channel_003', content: "Steph Curry changed the game." },
    { userId: 'user_004', channelId: 'channel_003', content: "Kobe's work ethic was unmatched." },
    { userId: 'user_004', channelId: 'channel_003', content: "Shaq was a dominant force." },
    { userId: 'user_004', channelId: 'channel_003', content: "The 3-point line should be moved back." },
    { userId: 'user_004', channelId: 'channel_003', content: "Giannis is a freak of nature." },
    { userId: 'user_004', channelId: 'channel_003', content: "The All-Star game needs more competition." },
    { userId: 'user_004', channelId: 'channel_003', content: "Boxing needs more diversity." },
    { userId: 'user_004', channelId: 'channel_003', content: "Boxing needs more excitement." },
    { userId: 'user_004', channelId: 'channel_003', content: "Boxing needs more innovation." },
    { userId: 'user_004', channelId: 'channel_003', content: "Boxing needs more transparency." },
    { userId: 'user_004', channelId: 'channel_003', content: "Boxing needs more rivalries." },
  ];

  // Create all messages
  for (const message of userMessages) {
  await prisma.message.create({
    data: {
        content: message.content,
        channelId: message.channelId,
        userId: message.userId,
    },
  });
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