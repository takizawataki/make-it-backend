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
 * @interface SummarizeRequest
 */
export interface SummarizeRequest {
    /**
     * セッション ID
     * @type {string}
     * @memberof SummarizeRequest
     */
    sessionId: string;
}

/**
 * Check if a given object implements the SummarizeRequest interface.
 */
export function instanceOfSummarizeRequest(value: object): value is SummarizeRequest {
    if (!('sessionId' in value) || value['sessionId'] === undefined) return false;
    return true;
}

export function SummarizeRequestFromJSON(json: any): SummarizeRequest {
    return SummarizeRequestFromJSONTyped(json, false);
}

export function SummarizeRequestFromJSONTyped(json: any, ignoreDiscriminator: boolean): SummarizeRequest {
    if (json == null) {
        return json;
    }
    return {
        
        'sessionId': json['sessionId'],
    };
}

export function SummarizeRequestToJSON(value?: SummarizeRequest | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'sessionId': value['sessionId'],
    };
}
