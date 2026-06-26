const http = require('http');

const submissions = [
  {
    userIdentifier: '+919876543210',
    userRole: 'traveler',
    mediaUrl: 'https://picsum.photos/800/600?random=101',
    fileName: 'sunset_at_goa.jpg',
    fileSize: 4521000,
    location: 'Goa (North & South Beaches)',
    travelDate: '2026-06-15',
    fullName: 'Rahul Sharma',
    tourManager: 'MMT-OP-24890',
    device: 'OPPO Reno15 Pro 5G',
    instaHandle: '@rahul_travels'
  },
  {
    userIdentifier: '+919988776655',
    userRole: 'traveler',
    mediaUrl: 'https://picsum.photos/800/600?random=102',
    fileName: 'munnar_tea_estates.jpg',
    fileSize: 5120000,
    location: 'Munnar Tea Gardens, Kerala',
    travelDate: '2026-06-10',
    fullName: 'Ananya Iyer',
    tourManager: 'MMT-OP-11223',
    device: 'OPPO Reno15 5G',
    instaHandle: '@ananya_iyer'
  },
  {
    userIdentifier: '+918877665544',
    userRole: 'traveler',
    mediaUrl: 'https://picsum.photos/800/600?random=103',
    fileName: 'kyoto_temples.jpg',
    fileSize: 3890000,
    location: 'Kyoto, Japan',
    travelDate: '2026-06-18',
    fullName: 'Vikram Singh',
    tourManager: 'MMT-OP-44556',
    device: 'OPPO Find X7 Ultra',
    instaHandle: '@vikram_adventures'
  },
  {
    userIdentifier: 'MMT-OP-12345',
    userRole: 'operator',
    mediaUrl: 'https://picsum.photos/800/600?random=104',
    fileName: 'maldives_villa.jpg',
    fileSize: 7800000,
    location: 'Maldives',
    travelDate: '2026-06-12',
    fullName: 'Amit Patel',
    tourManager: 'MMT-OP-12345',
    device: 'OnePlus 12',
    instaHandle: '@amit_maldives'
  },
  {
    userIdentifier: 'MMT-OP-12345',
    userRole: 'operator',
    mediaUrl: 'https://picsum.photos/800/600?random=105',
    fileName: 'paris_eiffel_tower.jpg',
    fileSize: 8540000,
    location: 'Paris, France',
    travelDate: '2026-06-14',
    fullName: 'Sophie Dubois',
    tourManager: 'MMT-OP-12345',
    device: 'OPPO Reno15 Pro 5G',
    instaHandle: '@sophie_in_paris'
  },
  {
    userIdentifier: '+917766554433',
    userRole: 'traveler',
    mediaUrl: 'https://picsum.photos/800/600?random=106',
    fileName: 'bali_swings.jpg',
    fileSize: 4200000,
    location: 'Bali, Indonesia',
    travelDate: '2026-06-05',
    fullName: 'Neha Kapoor',
    tourManager: 'MMT-OP-77889',
    device: 'OPPO Find N3 Flip',
    instaHandle: '@neha_explore'
  }
];

function postSubmission(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/submissions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 201) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Failed to post submission: ${res.statusCode} - ${body}`));
          }
        });
      }
    );

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('Seeding mock data to running server...');
  for (const sub of submissions) {
    try {
      const res = await postSubmission(sub);
      console.log(`Successfully seeded submission: ${res.data.file_name} (ID: ${res.data.id})`);
    } catch (err) {
      console.error(err.message);
    }
  }
  console.log('Seeding completed.');
}

run();
