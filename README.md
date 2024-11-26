# make-it-backend

## 開発を始める前に

以下のツールをインストールしてください。※既にインストール済の環境はスキップしてください。

### Node.js

TypeScript は JavaScript のスーパーセットなので、実⾏環境である Node.js のランタイムをインストールする必要があります。インストール⽅法は以下の 2 つがあります。

1. Node.js [公式サイト](https://nodejs.org) からダウンロードしてインストール
2. [nvm](https://github.com/nvm-sh/nvm) や [nodebrew](https://github.com/hokaccha/nodebrew) 等、コマンド上からインストール

Windows ユーザーは公式サイトから LTS 版をダウンロードしてインストールするのが、⼿間が少なくお勧めです。
正しくインストールされているか、バージョン番号を確認します。

```
node --version
```

※CDK の要件として、Node.js 10.3.0 以上が必要です。

### AWS CDK CLI

npm から CDK CLI をグローバル上にインストールします。バージョンアップする場合も同じです。

```
npm install -g aws-cdk
```

正しくインストールされているか、バージョン番号を確認します。

```
cdk --version
```

### AWS CLI

CDK では AWS 環境にアクセスする時に、AWS Command Line Interface（以降、AWS CLI）の設定ファイル（.aws/config）と認証情報ファイル（.aws/credentials）を参照します。
AWS CLI をインストールして初期設定をします。

インストールは[公式サイト](https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/getting-started-install.html)を参照してください。

AWS IAM コンソール上で IAM ユーザーを作成し、アクセスキー ID とシークレットアクセスキーを発⾏します。
AWS CLI の初期設定を⾏います。「aws configure」コマンドを利⽤して、設定ファイルと認証情報ファイルを作成します。

```
$ aws configure --profile xxxx
AWS Access Key ID [None]: ********************
AWS Secret Access Key [None]: ****************************************
Default region name [None]: ap-northeast-1
Default output format [None]: json
```

プロファイル名（xxxx）は好きな名前をつけてください。
アクセスキー ID とシークレットアクセスキーを設定します。また東京リージョンを指定しています。他のリージョンにする場合は変更してください。

正しくインストールされているか、バージョン番号を確認します。

```
aws --version
```

疎通確認（s3 バケット表⽰）を行います。

```
aws s3 ls --profile xxxx
```

上記コマンドにて、マネジメントコンソールで表示されているS3バケットの一覧が表示されていれば成功です。

### Docker

[Docker公式サイト](https://docs.docker.jp/desktop/install.html)から Docker をインストールしてください。

正しくインストールされているか、バージョン番号を確認します。

```
docker --version
```

### Git

git [公式サイト](https://git-scm.com) からダウンロードしてインストールするか、各種コマンド(Mac なら Homebrew、Linux なら yum や apt-get など)からインストールしてください。

正しくインストールされているか、バージョン番号を確認します。

```
git --version
```

### husky

- husky は git のフックを利用して、コミット時に lint を実行するためのツールです。
- 以下のコマンドで有効化してください。

```sh
npm run prepare
```

## ディレクトリ構造

```
.
├── bin
│   └── make-it-backend.ts          # App の定義
├── constructs
│   └── example.ts                  # 自作 construct の定義
├── lambda-code
│   └── example.ts                  # Lambda のランタイムコード
├── test
│   └── make-it-backend.test.ts     # テストコード
└── lib
    └── make-it-backend-stack.ts    # Stack の定義
└── utils
    └── example.ts                  # 便利なクラス・関数の定義
```

## 命名規則

### ディレクトリ/ファイル

- kebab-case

※ kebab-caseについては、[こちら](https://qiita.com/shota0616/items/4ac7a8696b3f6ccbe2bc)を参照

### AWSリソース名

- `${serviceName}-${branch}-kebab-case`

- IdBuilder クラスを使用してリソース名を生成してください（リソース名の一貫性のため）。
- 具体的な方法
  - `@/bin/make-it-backend.ts` で IdBuilder クラスをインスタンス化し、スタックに渡しています。
  - スタックから各コンストラクトに渡して、コンストラクタ内で name メソッドを使用してリソース名を生成します。

※ kebab-caseについては、[こちら](https://qiita.com/shota0616/items/4ac7a8696b3f6ccbe2bc)を参照

## 検証方法

### 簡易的な検証

- 以下のコマンドで ts-node を使ってローカルで実行できます。
  - `npx ts-node  -r tsconfig-paths/register <root からのファイルパス>`

### AWS アカウントで検証

- 以下のコマンドでデプロイできます。
  - cdk deploy -c branch=<任意の文字列> [--profile <プロファイル名>]
- AWS の認証情報にリージョン情報が含まれている場合、そのリージョンにデプロイされます。
- CLI の config ファイルでプロファイルの設定をしている人は、コマンド実行時に[--profile <プロファイル名>] を指定してください。
- 上記のデプロイコマンドで、こけたら CodeCatalyst に 1 回 push して workflow でも再現するか確認する。

### 超簡易的なテスト

- 以下のコマンドで CDK の構文にエラーがないかを確認できます。
  - `cdk synth`

### CDK のテスト

- CDK のスナップショットテスト
  - 概要：CDK で生成された Cfn テンプレートの断面を保持し、前回実行時との差分を確認するテストです。CDK の修正を加えた場合は、必ず実行し適切な修正になっているかの確認をお願いします。
  - テストコマンド：`npm test`
  - 適切な修正であればスナップショットを更新：`npm run update-snapshot-ci`
  - テストコマンドを再実行し Pass することを確認する：`npm test`
  - 参考資料：[AWS CDKのスナップショットテストに必要最低限の基礎](https://qiita.com/kiyoshi999/items/a3242159c1495249b751)

## 開発中に意識すること

### デプロイ失敗時

- 本番環境へのデプロイが失敗した場合、追加した機能をなくすコミットを作って CICD デプロイをしてください。

### パッケージ管理について

- パッケージ管理は以下 2 つを用います。
  - package.json
  - CodeCatalyst の package 機能
- 利用するパッケージを更新したタイミングで、以下コマンドで CodeCatalyst の パッケージリポジトリに情報を同期してください。
  - `npm publish`
  - 上記コマンドを実行する上で必要な準備や前提知識を身につけたい方は、[こちら](https://blog.serverworks.co.jp/2024/09/18/125942)のブログを参照してください。

### CDK について

- Stack, Construct の分割基準
  - Stack = CloudFormationのスタック。分割して他Stackから参照しすぎると後から変更が難しくなるため、必要以上に分割しない
  - Construct = リソース単体やリソースをグルーピングしたもの。積極的に小さくなるよう分割する
- Construct は基本的に L2 を検討する
- Lambda の construct は NodejsFunction を使用すること
  - トランスパイルまでラップしてくれる
  - Tree shaking でサイズを削減してくれる
- Context は workflow.yaml の変更が必要なこと

### TypeScript について

- [スタイルガイド（コーディング規約） - TypeScript Deep Dive 日本語版](https://typescript-jp.gitbook.io/deep-dive/styleguide)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
  - 基本的には上記に従うが、長大なので必要な部分だけ抜粋している
- 命名規則

|                  | 命名規則                                                    | その他                                                                      |
| ---------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| 変数             | `camelCase`                                                 | 基本的には `const` を使用する(※ `let` は極力使用しない、`var` は使用しない) |
| クラス           | クラス名：`PascalCase`<br>メンバ名・メソッド名：`camelCase` |                                                                             |
| 関数             | `camelCase`                                                 |                                                                             |
| インターフェース | クラス名：`PascalCase`<br>メンバ名：`camelCase`             | プレフィックスに`I`はつけない                                               |
| タイプ           | クラス名：`PascalCase`<br>メンバ名：`camelCase`             |                                                                             |
| 名前空間         | `PascalCase`                                                |                                                                             |
| Enum             | `PascalCase`                                                |                                                                             |

- 型定義は基本的に type を使用する
- 型推論が効く箇所は基本的に明示的な型付けは不要
- import の記述方法
  - named import を使用する（namespace import は極力使用しない）
  - import のパスはエイリアス（@）パスを使用する

```typescript
// bad
import * as lambda from 'aws-cdk-lib/aws-lambda';

// good
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda';
```

- JSDoc を記述する
  - コードの可読性を向上させるために、関数やクラスには JSDoc を記述する(以下、class の JSDoc の書き方)
  - 変数は、伝わりづらいと思ったものにはつける（ここは開発者の裁量に任せる）
  - JSDoc には型を書かない（ {string} など）

```typescript
/**
 * リソース名を生成するためのクラス
 */
export class IdBuilder {
  readonly serviceCode: string;
  readonly branchName: string;

  /**
   * IdBuilder クラスのコンストラクタ
   *
   * @param serviceCode - サービスコード
   * @param branchName - ブランチ名
   */
  constructor(serviceCode: string, branchName: string) {
    this.serviceCode = serviceCode;
    this.branchName = branchName;
  }

  /**
   * デプロイするリソース名を生成するメソッド
   *
   * @param name - 任意のリソース名。指定されない場合、サービスコードとブランチ名のみを使用します。
   * @returns 生成されたリソース名
   */
  name(name?: string) {
    if (name === undefined) return `${this.serviceCode}-${this.branchName}`;
    return `${this.serviceCode}-${this.branchName}-${name}`;
  }
}
```

- linter について
  - [typescript-eslint](https://typescript-eslint.io/) を使用する
  - 以下のコマンドで lint を実行して準拠していない箇所を確認できる
    - `npm run lint`
- formatter について
  - [Prettier](https://prettier.io/) を使用する
  - 以下のコマンドでフォーマットを実行できる
    - `npm run format`
- コミット時に linter と formatter が実行され、準拠していない箇所があればコミットできないように設定している
  - lint と format が通らない場合は修正してからコミットしてください

### API の開発について

- API の開発時の型（Request, Response）は、API 定義書からの自動生成したものを使用します。（安全性と効率向上のため）
- 以下のコマンドで型を生成します。
  - `npm run generate:model`
- 生成された型は `@/lambda-ts/types/generated/models` に保存されます。
- Request の型は event.body に、Response の型は return の body にあたるようにしてください。

### Python での開発について

- 以下の理由から、LangChain を用いる開発をする場合のみ、Python での開発が必要となります。
  - LangChain が Python をファーストであるため、JS 版は機能やドキュメントが遅れている可能性がある
  - LangChain においては Python の方がネット上に情報が多い

#### 必要なもの

- Python3.12.3
  - 使用する Python バージョンは.python-version ファイルで定義
  - 別の Python バージョンを使用する場合は必要に応じて.python-version ファイルの修正、もしくは.gitignore ファイルを編集して.python-version ファイルを git の管理対象から外す。

#### 仮想環境

- **`lambda-py` ディレクトリ内で**以下のコマンドを実行してください。
- Python の仮想環境を作成する
  - `python -m venv .venv`
  - ※ 仮想環境の名前は `.venv` である必要があります
    - gitignore で無視しているため
    - LambdaLayer のバンドル時に `.venv` を除外しているため
- 仮想環境を有効化する
  - `source .venv/bin/activate`
- インタープリターを設定する
  - コマンドプトンプトから、Python: Select Interpreter を選択し、作成した .venv の中の python を選択する

#### ライブラリのインストール

※ 仮想環境に入った状態で行ってください。

- ライブラリをインストールする
  - `pip install <library>`

#### CDK デプロイ、もしくはリモートリポジトリへのプッシュ時に行うこと

※ 仮想環境に入った状態で行ってください。

- requirements.txt を更新する
  - `pip freeze > requirements.txt`

#### linter, formatter について

- linter

  - [flake8](https://flake8.pycqa.org/en/latest/) を使用する

- formatter

  - [black](https://black.readthedocs.io/en/stable/) を使用する
  - [isort](https://pycqa.github.io/isort/) を使用する

- ライブラリとしてインストールはせず、あくまで VSCode の拡張機能を利用する
  - すでに .vscode/settings.json に設定が記述されている
    - 明示的な保存時にフォーマットが実行される
  - .vscode/extensions.json に拡張機能のリストが記述されているので、VSCode にインストールしてください

#### 静的解析

- 静的解析ツールとして、[pylance](https://marketplace.visualstudio.com/items?itemName=ms-python.vscode-pylance) を使用する
  - すでに .vscode/settings.json に設定が記述されている

## 参考情報

- [AWS CDK の規範ガイダンス](https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/best-practices-cdk-typescript-iac/constructs-best-practices.html)
- [アノテーションコメント](https://qiita.com/taka-kawa/items/673716d77795c937d422)
