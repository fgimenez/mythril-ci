import httpStatus from 'http-status';
import {
  serverRequest,
  getUserFromDatabase,
  setUserProperty,
  makeUserAdmin,
  loginUser,
  registerAndActivateUser,
} from '../utils';

describe('Rate limit', () => {
  let email;
  let token;
  beforeEach(async () => {
    email = await registerAndActivateUser();
    token = await loginUser(email);
  });
  it('5 min limit', async () => {
    await serverRequest
      .get('/v1/analyses/notexist')
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.BAD_REQUEST);
    const user = await getUserFromDatabase(email);
    expect(user.limitCounters.fiveMin).toBe(1);
    await setUserProperty(
      email,
      {'limitCounters.fiveMin': 10}
    );
    await serverRequest
      .get('/v1/analyses/notexist')
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.TOO_MANY_REQUESTS);
    const fiveMinInMilliseconds = 300000;
    await setUserProperty(
      email,
      {'recordedTimeOfFirstRequests.fiveMin': user.recordedTimeOfFirstRequests.fiveMin - fiveMinInMilliseconds}
    );
    await serverRequest
      .get('/v1/analyses/notexist')
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.BAD_REQUEST);
  });
  it('1 hour limit', async () => {
    await serverRequest
      .get('/v1/analyses/notexist')
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.BAD_REQUEST);
    const user = await getUserFromDatabase(email);
    expect(user.limitCounters.oneHour).toBe(1);
    await setUserProperty(
      email,
      {'limitCounters.oneHour': 30}
    );
    await serverRequest
      .get('/v1/analyses/notexist')
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.TOO_MANY_REQUESTS);
    const oneHourInMilliseconds = 3600000;
    await setUserProperty(
      email,
      {'recordedTimeOfFirstRequests.oneHour': user.recordedTimeOfFirstRequests.oneHour - oneHourInMilliseconds}
    );
    await serverRequest
      .get('/v1/analyses/notexist')
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.BAD_REQUEST);
  });
  it('1 day limit', async () => {
    await serverRequest
      .get('/v1/analyses/notexist')
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.BAD_REQUEST);
    const user = await getUserFromDatabase(email);
    expect(user.limitCounters.oneDay).toBe(1);
    await setUserProperty(
      email,
      {'limitCounters.oneDay': 100}
    );
    await serverRequest
      .get('/v1/analyses/notexist')
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.TOO_MANY_REQUESTS);
    const oneDayInMilliseconds = 86400000;
    await setUserProperty(
      email,
      {'recordedTimeOfFirstRequests.oneDay': user.recordedTimeOfFirstRequests.oneDay - oneDayInMilliseconds}
    );
    await serverRequest
      .get('/v1/analyses/notexist')
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.BAD_REQUEST);
  });
  it('stress test (race condition)', async () => {
    await makeUserAdmin(email);
    const token = await loginUser(email);
    const numberOfRequest = 30;
    // eslint-disable-next-line
    for (let i = 0; i < numberOfRequest; i++) {
      await serverRequest
        .get('/v1/analyses/notexist')
        .set('Authorization', `Bearer ${token}`)
        .expect(httpStatus.BAD_REQUEST);
    }
    const user = await getUserFromDatabase(email);
    expect(user.limitCounters.oneDay).toBe(numberOfRequest);
  });
});

