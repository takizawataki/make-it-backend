/* tslint:disable */
/* eslint-disable */
/**
 * 「make it !」REST API仕様書
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 0.0.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { mapValues } from '../runtime';
/**
 * 
 * @export
 * @interface UserUpdateResponse
 */
export interface UserUpdateResponse {
    /**
     * ユーザー ID（Cognito の sub 属性）
     * @type {string}
     * @memberof UserUpdateResponse
     */
    userId: string;
    /**
     * ユーザーのメールアドレス
     * @type {string}
     * @memberof UserUpdateResponse
     */
    email: string;
    /**
     * ユーザー名
     * @type {string}
     * @memberof UserUpdateResponse
     */
    displayName?: string;
    /**
     * セッション IDのリスト
     * @type {Array<string>}
     * @memberof UserUpdateResponse
     */
    sessionIds?: Array<string>;
    /**
     * 転送されたセッション IDのリスト
     * @type {Array<string>}
     * @memberof UserUpdateResponse
     */
    escalatedSessionIds?: Array<string>;
    /**
     * 招待者のユーザー ID
     * @type {string}
     * @memberof UserUpdateResponse
     */
    inviter?: string;
}

/**
 * Check if a given object implements the UserUpdateResponse interface.
 */
export function instanceOfUserUpdateResponse(value: object): value is UserUpdateResponse {
    if (!('userId' in value) || value['userId'] === undefined) return false;
    if (!('email' in value) || value['email'] === undefined) return false;
    return true;
}

export function UserUpdateResponseFromJSON(json: any): UserUpdateResponse {
    return UserUpdateResponseFromJSONTyped(json, false);
}

export function UserUpdateResponseFromJSONTyped(json: any, ignoreDiscriminator: boolean): UserUpdateResponse {
    if (json == null) {
        return json;
    }
    return {
        
        'userId': json['userId'],
        'email': json['email'],
        'displayName': json['displayName'] == null ? undefined : json['displayName'],
        'sessionIds': json['sessionIds'] == null ? undefined : json['sessionIds'],
        'escalatedSessionIds': json['escalatedSessionIds'] == null ? undefined : json['escalatedSessionIds'],
        'inviter': json['inviter'] == null ? undefined : json['inviter'],
    };
}

export function UserUpdateResponseToJSON(value?: UserUpdateResponse | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'userId': value['userId'],
        'email': value['email'],
        'displayName': value['displayName'],
        'sessionIds': value['sessionIds'],
        'escalatedSessionIds': value['escalatedSessionIds'],
        'inviter': value['inviter'],
    };
}

