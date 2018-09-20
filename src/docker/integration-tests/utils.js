import config from 'config';
import httpStatus from 'http-status';
import {MongoClient} from 'mongodb';
import request from 'supertest';
import uuidV4 from 'uuid/v4';
import bluebird from 'bluebird';

global.Promise = bluebird;
require('babel-runtime/core-js/promise').default = bluebird; // eslint-disable-line import/no-commonjs

const serverRequest = request(`http://127.0.0.1:${process.env.PORT}`);
const PASSWORD = 'Casd@123123';
/**
 * For the given uuid, waits until the current status is no longer the passed currentStatus argument, and expects
 * the new status is the passed nextStatus argument.
 * @param {string} uuid
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @param {string} token
 * @param {function} expect
 */
async function waitForStatusUpdate(uuid, currentStatus, nextStatus, token, expect) {
  let res;

  // eslint-disable-next-line no-constant-condition, no-restricted-syntax
  while (true) {
    const delayMS = 50;
    await Promise.delay(delayMS);

    res = await serverRequest
      .get(`/v1/analyses/${uuid}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.OK);
    const result = res.body.status;
    if (result !== currentStatus) {
      expect(result).toBe(nextStatus);
      break;
    }
  }
}

/**
 * Generate random email address
 * @returns {string} random email address
 */
function generateEmailAddress() {
  return `${uuidV4()}@test.com`;
}

/**
 * Fetch user object from database
 * @param {string} email email address
 * @returns {Object} user
 */
async function getUserFromDatabase(email) {
  const client = await MongoClient.connect(
    config.MONGODB_URL, {
      useNewUrlParser: true,
    },
  );
  let user;
  try {
    const userCollection = await client.db().collection('users');
    user = await userCollection.findOne({email_lowered: email.toLowerCase()});
  } finally {
    await client.close();
  }
  return user;
}

/**
 * Fetch jwt from database
 * @param {string} refreshToken
 * @param {string} userId
 * @returns {Object}
 */
async function getJwtFromDatabase(refreshToken, userId) {
  const client = await MongoClient.connect(
    config.MONGODB_URL, {
      useNewUrlParser: true,
    },
  );
  let jwt;
  try {
    const jwtCollection = await client.db().collection('jwts');
    if (refreshToken) {
      jwt = await jwtCollection.findOne({refreshToken});
    } else {
      jwt = await jwtCollection.findOne({userId});
    }
  } finally {
    await client.logout();
  }
  return jwt;
}


/**
 * Generate new user email and register the user
 */
async function registerUser() {
  const email = generateEmailAddress();
  await serverRequest
    .post('/v1/auth/user')
    .send({
      firstName: 'David',
      gReCaptcha: 'DUMMY_TOKEN',
      lastName: 'Martin',
      email,
      termsId: 'no_terms',
    });
  return email;
}

/**
 * Activate user account
 * @param {String} email
 */
async function activateUser(email) {
  const user = await getUserFromDatabase(email);
  await serverRequest
    .post('/mythril/v1/users/' + user._id + '/activate')
    .send({
      verificationCode: user.verificationCode,
      password: PASSWORD,
    });
}

/**
 * Register and activate the user account
 */
async function registerAndActivateUser() {
  const email = await registerUser();
  await activateUser(email);
  return email;
}

/**
 * login user
 * @param {String} email
 * @returns {object} token
 */
async function loginUser(email) {
  const res = await serverRequest
    .post('/mythril/v1/auth/login')
    .send({
      email,
      password: PASSWORD,
    });
  return res.body.accessToken;
}

/**
 * Get valid user
 *
 * @returns {object} user
 */
async function getValidUser() {
  const {email} = await getValidCredential();
  return await getUserFromDatabase(email);
}

/**
 * Set user property
 * @param {string} email email address
 * @param {object} values
 * @returns {object} user user object
 */
async function setUserProperty(email, values) {
  const client = await MongoClient.connect(
    config.MONGODB_URL, {
      useNewUrlParser: true,
    },
  );
  let user;
  try {
    const userCollection = await client.db().collection('users');
    user = await userCollection.findOneAndUpdate({email_lowered: email.toLowerCase()}, {$set: values});
  } finally {
    await client.close();
  }
  return user;
}

/**
 * Add admin as type
 * @param {string} email email address
 * @param {object} values
 */
async function makeUserAdmin(email) {
  await setUserProperty(email, {type: ['user', 'admin']});
}

export {
  serverRequest,
  waitForStatusUpdate,
  generateEmailAddress,
  getUserFromDatabase,
  getJwtFromDatabase,
  getValidUser,
  makeUserAdmin,
  setUserProperty,
  loginUser,
  registerUser,
  registerAndActivateUser,
  PASSWORD
};
