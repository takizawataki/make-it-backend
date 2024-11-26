/**
 * 各 id, name を生成するためのクラス
 */
export class IdBuilder {
  readonly serviceCode: string;
  readonly branchName: string;

  constructor(serviceCode: string, branchName: string) {
    this.serviceCode = serviceCode;
    this.branchName = branchName;
  }

  /**
   * デプロイするリソース名を生成する
   *
   * @param name - リソース名
   */
  name(name?: string) {
    if (name === undefined) return `${this.serviceCode}-${this.branchName}`;
    return `${this.serviceCode}-${this.branchName}-${name}`;
  }
}
