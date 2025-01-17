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
import type { GenerateSessionTitleRequestSessionHistoryInner } from './GenerateSessionTitleRequestSessionHistoryInner';
import {
    GenerateSessionTitleRequestSessionHistoryInnerFromJSON,
    GenerateSessionTitleRequestSessionHistoryInnerFromJSONTyped,
    GenerateSessionTitleRequestSessionHistoryInnerToJSON,
} from './GenerateSessionTitleRequestSessionHistoryInner';

/**
 * 
 * @export
 * @interface GenerateSessionTitleRequest
 */
export interface GenerateSessionTitleRequest {
    /**
     * セッション ID
     * @type {string}
     * @memberof GenerateSessionTitleRequest
     */
    sessionId: string;
    /**
     * セッション履歴
     * @type {Array<GenerateSessionTitleRequestSessionHistoryInner>}
     * @memberof GenerateSessionTitleRequest
     */
    sessionHistory: Array<GenerateSessionTitleRequestSessionHistoryInner>;
}

/**
 * Check if a given object implements the GenerateSessionTitleRequest interface.
 */
export function instanceOfGenerateSessionTitleRequest(value: object): value is GenerateSessionTitleRequest {
    if (!('sessionId' in value) || value['sessionId'] === undefined) return false;
    if (!('sessionHistory' in value) || value['sessionHistory'] === undefined) return false;
    return true;
}

export function GenerateSessionTitleRequestFromJSON(json: any): GenerateSessionTitleRequest {
    return GenerateSessionTitleRequestFromJSONTyped(json, false);
}

export function GenerateSessionTitleRequestFromJSONTyped(json: any, ignoreDiscriminator: boolean): GenerateSessionTitleRequest {
    if (json == null) {
        return json;
    }
    return {
        
        'sessionId': json['sessionId'],
        'sessionHistory': ((json['sessionHistory'] as Array<any>).map(GenerateSessionTitleRequestSessionHistoryInnerFromJSON)),
    };
}

export function GenerateSessionTitleRequestToJSON(value?: GenerateSessionTitleRequest | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'sessionId': value['sessionId'],
        'sessionHistory': ((value['sessionHistory'] as Array<any>).map(GenerateSessionTitleRequestSessionHistoryInnerToJSON)),
    };
}

