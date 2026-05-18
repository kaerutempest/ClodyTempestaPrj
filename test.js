import fs from 'fs';

async function test() {
  const res = await fetch('http://localhost:3000/preview/bfaded6f9020d992553b5659973096ce');
  console.log(res.status, res.headers.get('content-type'));
}
test();
