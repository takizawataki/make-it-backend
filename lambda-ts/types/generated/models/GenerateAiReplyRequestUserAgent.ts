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
 * ユーザーエージェント情報
 * @export
 * @interface GenerateAiReplyRequestUserAgent
 */
export interface GenerateAiReplyRequestUserAgent {
    /**
     * OS 名
     * @type {string}
     * @memberof GenerateAiReplyRequestUserAgent
     */
    osName: string;
    /**
     * ブラウザ名
     * @type {string}
     * @memberof GenerateAiReplyRequestUserAgent
     */
    browserName: string;
    /**
     * デバイス名
     * @type {string}
     * @memberof GenerateAiReplyRequestUserAgent
     */
    deviceName: string;
}

/**
 * Check if a given object implements the GenerateAiReplyRequestUserAgent interface.
 */
export function instanceOfGenerateAiReplyRequestUserAgent(value: object): value is GenerateAiReplyRequestUserAgent {
    if (!('osName' in value) || value['osName'] === undefined) return false;
    if (!('browserName' in value) || value['browserName'] === undefined) return false;
    if (!('deviceName' in value) || value['deviceName'] === undefined) return false;
    return true;
}

export function GenerateAiReplyRequestUserAgentFromJSON(json: any): GenerateAiReplyRequestUserAgent {
    return GenerateAiReplyRequestUserAgentFromJSONTyped(json, false);
}

export function GenerateAiReplyRequestUserAgentFromJSONTyped(json: any, ignoreDiscriminator: boolean): GenerateAiReplyRequestUserAgent {
    if (json == null) {
        return json;
    }
    return {
        
        'osName': json['osName'],
        'browserName': json['browserName'],
        'deviceName': json['deviceName'],
    };
}

export function GenerateAiReplyRequestUserAgentToJSON(value?: GenerateAiReplyRequestUserAgent | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'osName': value['osName'],
        'browserName': value['browserName'],
        'deviceName': value['deviceName'],
    };
}
