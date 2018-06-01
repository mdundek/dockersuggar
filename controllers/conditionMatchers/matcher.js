"use strict"

/**
 * CONDITION MATCHER: matcher_has_attributes
 */
exports.matcher_has_attributes = (session, value) => {
    return value && Object.keys(value).length > 0;
}

/**
 * CONDITION MATCHER: matcher_array_not_empty
 */
exports.matcher_array_not_empty = (session, value) => {
    return value && value.length > 0;
}

/**
 * CONDITION MATCHER: matcher_array_empty
 */
exports.matcher_array_empty = (session, value) => {
    return !value || value.length == 0;
}

/**
 * CONDITION MATCHER: matcher_has_no_attributes
 */
exports.matcher_has_no_attributes = (session, value) => {
    return !value || Object.keys(value).length == 0;
}