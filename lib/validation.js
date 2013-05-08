'use strict';

var countries = require('./validation/countries');
var states = require('./validation/states');
var currencies = require('./validation/currencies');

var check = require('validator').check;

module.exports = function (opts) {

    opts = opts || {};

    var validationObjects = {
        creditCardType: {
            notEmpty: [],
            isIn : [['Visa','AmericanExpress','MasterCard','Discover']]
        },
        creditCardNumber: {
            notEmpty: [],
            isCreditCard: []
        },
        expirationMonth: {
            notEmpty: [],
            len: [2, 2],
            isNumeric: [],
            min: [1],
            max: [12],
            future: function (month, obj) {
                var date = new Date();
                var y = date.getFullYear();
                var m = date.getMonth();

                if((+obj.expirationYear < y) || (+obj.expirationYear === +y && +month <= +m)) {
                    throw new Error('Must be future date');
                }
            }
        },
        expirationYear: {
            notEmpty: [],
            len: [4, 4],
            isNumeric: [],
            min: [2013],
            max: [2030],
            future: function (year, obj) {
                var date = new Date();
                var y = date.getFullYear();
                var m = date.getMonth();

                if((+year < +y) || (+year === +y && +obj.expirationMonth <= +m)) {
                    throw new Error('Must be future date');
                }
            }
        },
        securityCode: {
            notEmpty: [],
            len: [3,3]
        },
        cardHolderName: {
            notEmpty: []
        },
        city: {
            notEmpty: []
        },
        country: {
            isIn: [countries.getArray(opts.countries, true)]
        },
        state: function (data) {
            var validate = {
                notEmpty: []
            };
            if(data['country'] === 'Canada' || data['country'] === 'CAN') {
                validate.isIn = [states.canada.all]
            } else if(data['country'] === 'United States' || data['country'] === 'USA') {
                validate.isIn = [states.us.all]
            }
            return validate;
        },
        zipCode: {
            notEmpty: []
        }
    };

    var validationRules = {
        paymentCreate: {
            accountKey: {
                notEmpty: []
            },
            creditCardType: validationObjects.creditCardType,
            creditCardNumber: validationObjects.creditCardNumber,
            expirationMonth: validationObjects.expirationMonth,
            expirationYear: validationObjects.expirationYear,
            securityCode: validationObjects.securityCode,
            cardHolderInfo: {
                subObjects: {
                    cardHolderName: validationObjects.cardHolderName,
                    city: validationObjects.city,
                    country: validationObjects.country,
                    state: validationObjects.state,
                    zipCode: validationObjects.zipCode
                }
            }
        },
        paymentUpdate: {
            expirationMonth: validationObjects.expirationMonth,
            expirationYear: validationObjects.expirationYear,
            securityCode: validationObjects.securityCode,
            cardHolderName: validationObjects.cardHolderName,
            city: validationObjects.city,
            country: validationObjects.country,
            state: validationObjects.state,
            zipCode: validationObjects.zipCode
        },
        accountCreate: {
            accountNumber: {
                notEmpty: []
            },
            name: {
                notEmpty: []
            },
            currency: {
                notEmpty: [],
                isIn: [currencies.currencies.all]
            },
            paymentTerm: {
                notEmpty: [],
                isIn: [[ 'Due Upon Receipt', 'Net 30', 'Net 60', 'Net 90']]
            },
            billToContact: {
                notNull: [],
                subObjects: {
                    firstName: {
                        notEmpty: []
                    },
                    lastName: {
                        notEmpty: []
                    }
                }
            }
        }
    };

    return function (type, data) {
        if(typeof data !== 'object') {
            return new TypeError('Input data missing');
        }

        var allRules = validationRules[type];

        if(!allRules) {
            return null;
        }

        var errors = [];

        function checkCycle(obj, rules, pre) {
            Object.keys(rules).forEach(function (name) {
                var rule;
                if(typeof rules[name] === 'function') {
                    rule = rules[name](obj);
                } else {
                    rule = rules[name];
                }
                Object.keys(rule).some(function (fn) {
                    if(fn !== 'subObjects') {
                        try {
                            var val = typeof (obj[name]) === 'string' ? obj[name].trim() : obj[name];
                            if(typeof rule[fn] === 'function') {
                                rule[fn](val, obj);
                            } else if (rule[fn].length) {
                                var a = check(val);
                                a[fn].apply(a, rule[fn]);
                            } else {
                                check(val)[fn]();
                            }
                        } catch (e) {
                            errors.push({name: (pre ? pre + '.' + name : name), message: e.message, fn: fn, v: obj[name]});
                            return true;
                        }
                    } else {
                        checkCycle(obj[name], rule[fn], (pre ? pre + '.' + name : name));
                    }
                    return false;
                });
            });
        }

        checkCycle(data, allRules);

        var ret = null;

        if(errors.length) {
            ret = {};
            errors.forEach(function (err) {
                ret[err.name] = err.message;
            });
        }


        return ret;
    };
};
