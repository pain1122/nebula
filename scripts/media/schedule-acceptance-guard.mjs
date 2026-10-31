import assert from 'node:assert/strict';

export const scheduleScope = Object.freeze({
  project: 'checkupino_schedule_acceptance',
  container: 'checkupino_schedule_acceptance-mysql-acceptance-1',
  network: 'checkupino_schedule_acceptance_acceptance',
  database: 'checkupino_schedule_acceptance',
  user: 'schedule_acceptance',
  mysqlImage: 'sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b',
  phpImage: 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746',
});

// Pure admission guard: called before any PHP/SQL operation, never logs env values.
export function admitScheduleDatabase(db, net, members) {
  const s = scheduleScope;
  assert.equal(db.Name, '/' + s.container);
  assert.equal(db.Image, s.mysqlImage);
  assert.equal(db.Config.Labels['com.docker.compose.project'], s.project);
  assert.equal(db.Config.Labels['com.docker.compose.service'], 'mysql-acceptance');
  assert.equal(db.State.Running, true);
  assert.equal(db.State.Health.Status, 'healthy');
  assert.equal(db.State.OOMKilled, false);
  assert.equal(db.RestartCount, 0);
  assert.equal(db.Config.User, '999:999');
  const host = db.HostConfig;
  assert.equal(host.RestartPolicy.Name, 'no');
  assert.equal(host.ReadonlyRootfs, true);
  assert.equal(host.Privileged, false);
  assert.equal(host.Memory, 1073741824);
  assert.equal(host.MemorySwap, 1073741824);
  assert.equal(host.NanoCpus, 1000000000);
  assert.equal(host.PidsLimit, 64);
  assert.deepEqual(host.CapDrop, ['ALL']);
  assert.deepEqual(host.CapAdd ?? [], []);
  assert.deepEqual(host.SecurityOpt, ['no-new-privileges:true']);
  assert.equal(Object.keys(host.PortBindings ?? {}).length, 0);
  assert.deepEqual(db.Mounts, []);
  assert.deepEqual(host.Tmpfs, {
    '/var/lib/mysql': 'size=512m,mode=0700,uid=999,gid=999',
    '/var/run/mysqld': 'size=4m,mode=0755,uid=999,gid=999',
    '/tmp': 'size=32m,mode=1777',
  });
  assert.deepEqual(Object.keys(db.NetworkSettings.Networks), [s.network]);
  assert.equal(net.Name, s.network);
  assert.equal(net.Internal, true);
  assert.equal(net.Labels['com.docker.compose.project'], s.project);
  assert.deepEqual(Object.values(net.Containers).map(value => value.Name), [s.container]);
  assert.deepEqual(members, [s.container]);
  const env = Object.fromEntries(db.Config.Env.map(value => {
    const at = value.indexOf('=');
    return [value.slice(0, at), value.slice(at + 1)];
  }));
  assert.equal(env.MYSQL_DATABASE, s.database);
  assert.equal(env.MYSQL_USER, s.user);
  assert.ok(/^[a-f0-9]{32}$/.test(env.MYSQL_PASSWORD ?? ''), 'A temporary operator-generated password is required.');
  return env.MYSQL_PASSWORD;
}
