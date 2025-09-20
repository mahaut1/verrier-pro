process.env.NODE_ENV = 'test';
try { require('dotenv').config({ path: '.env.test', debug: false }); } catch {}
