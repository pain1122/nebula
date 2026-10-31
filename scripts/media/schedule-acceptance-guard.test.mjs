import assert from 'node:assert/strict';
import test from 'node:test';
import { admitScheduleDatabase, scheduleScope as s } from './schedule-acceptance-guard.mjs';

const fixture = () => ({
  db: {
    Name: '/' + s.container, Image: s.mysqlImage, RestartCount: 0,
    Config: { User: '999:999', Labels: { 'com.docker.compose.project': s.project, 'com.docker.compose.service': 'mysql-acceptance' },
      Env: ['MYSQL_DATABASE=' + s.database, 'MYSQL_USER=' + s.user, 'MYSQL_PASSWORD=' + 'a'.repeat(32)] },
    State: { Running: true, Health: { Status: 'healthy' }, OOMKilled: false },
    HostConfig: { RestartPolicy: { Name: 'no' }, ReadonlyRootfs: true, Privileged: false,
      Memory: 1073741824, MemorySwap: 1073741824, NanoCpus: 1000000000, PidsLimit: 64,
      CapDrop: ['ALL'], CapAdd: null, SecurityOpt: ['no-new-privileges:true'], PortBindings: {},
      Tmpfs: { '/var/lib/mysql': 'size=512m,mode=0700,uid=999,gid=999', '/var/run/mysqld': 'size=4m,mode=0755,uid=999,gid=999', '/tmp': 'size=32m,mode=1777' } },
    Mounts: [], NetworkSettings: { Networks: { [s.network]: {} } },
  },
  net: { Name: s.network, Internal: true, Labels: { 'com.docker.compose.project': s.project }, Containers: { synthetic: { Name: s.container } } },
  members: [s.container],
});
test('only the healthy pinned isolated disposable database is admitted', () => {
  const { db, net, members } = fixture();
  assert.equal(admitScheduleDatabase(db, net, members), 'a'.repeat(32));
});
const refusals = {
  'live database substituted': f => { f.db.Name = '/checkupino_db'; },
  'wrong project label': f => { f.db.Config.Labels['com.docker.compose.project'] = 'checkupino'; },
  'unpinned image': f => { f.db.Image = 'mysql:latest'; },
  'stopped database': f => { f.db.State.Running = false; },
  'unhealthy database': f => { f.db.State.Health.Status = 'unhealthy'; },
  'OOM failure': f => { f.db.State.OOMKilled = true; },
  'automatic restart': f => { f.db.RestartCount = 1; },
  'restart policy': f => { f.db.HostConfig.RestartPolicy.Name = 'always'; },
  'root identity': f => { f.db.Config.User = '0:0'; },
  'writable root': f => { f.db.HostConfig.ReadonlyRootfs = false; },
  'privileged runtime': f => { f.db.HostConfig.Privileged = true; },
  'extra capabilities': f => { f.db.HostConfig.CapAdd = ['SYS_ADMIN']; },
  'missing capability drop': f => { f.db.HostConfig.CapDrop = []; },
  'missing no-new-privileges': f => { f.db.HostConfig.SecurityOpt = []; },
  'published port': f => { f.db.HostConfig.PortBindings = { '3306/tcp': [{ HostPort: '3307' }] }; },
  'durable volume': f => { f.db.Mounts = [{ Type: 'volume', Destination: '/var/lib/mysql' }]; },
  'live bind mount': f => { f.db.Mounts = [{ Type: 'bind', Source: 'live', Destination: '/live' }]; },
  'uncapped memory': f => { f.db.HostConfig.Memory = 0; },
  'extra swap': f => { f.db.HostConfig.MemorySwap = -1; },
  'uncapped PIDs': f => { f.db.HostConfig.PidsLimit = 0; },
  'uncapped CPUs': f => { f.db.HostConfig.NanoCpus = 0; },
  'changed tmpfs ownership': f => { f.db.HostConfig.Tmpfs['/var/lib/mysql'] = 'size=512m,mode=0777'; },
  'additional network': f => { f.db.NetworkSettings.Networks.checkupino_default = {}; },
  'external network': f => { f.net.Internal = false; },
  'unexpected attached client': f => { f.net.Containers.other = { Name: 'checkupino_app' }; },
  'foreign network owner': f => { f.net.Labels['com.docker.compose.project'] = 'other'; },
  'unexpected project service': f => { f.members.push('another-service'); },
  'wrong database': f => { f.db.Config.Env[0] = 'MYSQL_DATABASE=checkupino'; },
  'root database user': f => { f.db.Config.Env[1] = 'MYSQL_USER=root'; },
  'missing temporary password': f => { f.db.Config.Env.pop(); },
};
for (const [name, change] of Object.entries(refusals)) test('refuses ' + name + ' before any SQL', () => {
  const f = fixture();
  change(f);
  assert.throws(() => admitScheduleDatabase(f.db, f.net, f.members));
});
