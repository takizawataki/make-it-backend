// eslint-disable-next-line @typescript-eslint/no-require-imports
const { basename, join } = require('path');

/**
 * 環境変数 `JEST_SNAPSHOT_DIR` からスナップショットディレクトリのパスを取得します。
 * 環境変数が設定されていない場合はエラーをスローします。
 *
 * @returns {string} スナップショットディレクトリのパス
 * @throws `Error` - `JEST_SNAPSHOT_DIR` が設定されていない場合にエラーをスローします。
 */
const getSnapshotDir = () => {
  const dir = process.env.JEST_SNAPSHOT_DIR;
  if (!dir) {
    throw new Error('JEST_SNAPSHOT_DIR is not set');
  }
  return dir;
};

/**
 * テストファイルのパスとスナップショットの拡張子をもとに、スナップショットファイルの保存先パスを解決します。
 *
 * @param {string} testPath - テストファイルのパス
 * @param {string} snapshotExtension - スナップショットファイルの拡張子
 * @returns {string} スナップショットファイルの保存先パス
 */
function resolveSnapshotPath(testPath, snapshotExtension) {
  const snapshotDir = getSnapshotDir();
  const fileName = basename(testPath);
  return join(snapshotDir, `${fileName}${snapshotExtension}`);
}

/**
 * スナップショットファイルのパスと拡張子から、テストファイルのパスを解決します。
 *
 * @param {string} snapshotFilePath - スナップショットファイルのパス
 * @param {string} snapshotExtension - スナップショットファイルの拡張子
 * @returns {string} テストファイルのパス
 */
function resolveTestPath(snapshotFilePath, snapshotExtension) {
  const testFileName = basename(snapshotFilePath, snapshotExtension);
  return join(__dirname, 'test', testFileName);
}

/**
 * Jest がファイルパスが正しいか確認するために使用するテストファイル名。
 * 一貫性の確認に利用される。
 */
const testPathForConsistencyCheck = join(__dirname, 'test', 'some.test.ts');

// CommonJSスタイルのエクスポート
module.exports = {
  resolveSnapshotPath,
  resolveTestPath,
  testPathForConsistencyCheck,
};
