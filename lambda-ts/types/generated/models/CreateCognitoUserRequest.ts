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
 * @interface CreateCognitoUserRequest
 */
export interface CreateCognitoUserRequest {
    /**
     * 被招待者のメールアドレス
     * @type {string}
     * @memberof CreateCognitoUserRequest
     */
    email: string;
    /**
     * 招待者の cognito sub 属性
     * @type {string}
     * @memberof CreateCognitoUserRequest
     */
    inviter: string;
}

/**
 * Check if a given object implements the CreateCognitoUserRequest interface.
 */
export function instanceOfCreateCognitoUserRequest(value: object): value is CreateCognitoUserRequest {
    if (!('email' in value) || value['email'] === undefined) return false;
    if (!('inviter' in value) || value['inviter'] === undefined) return false;
    return true;
}

export function CreateCognitoUserRequestFromJSON(json: any): CreateCognitoUserRequest {
    return CreateCognitoUserRequestFromJSONTyped(json, false);
}

export function CreateCognitoUserRequestFromJSONTyped(json: any, ignoreDiscriminator: boolean): CreateCognitoUserRequest {
    if (json == null) {
        return json;
    }
    return {
        
        'email': json['email'],
        'inviter': json['inviter'],
    };
}

export function CreateCognitoUserRequestToJSON(value?: CreateCognitoUserRequest | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'email': value['email'],
        'inviter': value['inviter'],
    };
}
