'use strict';

const Merge = require('lodash.merge');
const Hoek  = require('hoek');
const Model = require('schwifty').Model;
const Joi   = require('joi');
const Utils = require('./utils');

module.exports = (baseModel, options = {}) => {

    const translationTableName = Hoek.reach(options, 'translationTable', { default : `${baseModel.getTableName()}Translation` });
    options.relationName       = Hoek.reach(options, 'relationName', { default : 'i18n' });
    options.defaultLocale      = Hoek.reach(options, 'defaultLocal', { default : 'en_US' });
    options.modelName          = Hoek.reach(options, 'modelName', { default : baseModel.name });

    const translationModel = Utils.renameClass(class extends Model {

        static get tableName() {

            return translationTableName;
        }

        static get joiObject() {

            return {
                id          : Joi.number().integer(),
                tableId     : Joi.string(),
                locale      : Joi.string().example('en_US'),
                column      : Joi.string(),
                translation : Joi.string()
            };
        }

    }, translationTableName);

    const m = Utils.renameClass(class extends Utils.I18ObjectionPlugin()(baseModel) {

        static relationMappings() {

            return Merge(Hoek.reach(baseModel, 'relationMappings'), {
                [options.relationName] : {
                    relation   : Model.HasManyRelation,
                    modelClass : translationModel,
                    join       : {
                        from : `${super.tableName}.id`,
                        to   : `${translationModel.tableName}.tableId`
                    }
                }
            });
        }

        static get translatable() {

            const translatable = [];

            const children = super.joiSchema.describe().children;

            Object.keys(children).forEach((v) => {

                const meta = Merge(...Hoek.reach(children[v], 'meta', { default : [{ translate : false }] }));

                if (meta.translate) {
                    translatable.push(v);
                }
            });

            return translatable;
        }

        static get joiSchema() {

            return super.joiSchema.keys({
                [options.relationName] : Joi.array().items({
                    locale      : Joi.string(),
                    column      : Joi.string().allow(this.translatable),
                    translation : Joi.string()
                })
            });
        }

        static translate(model, locale) {

            if (locale) {

                if (!model[options.relationName].find((v) => v.locale === locale)) {
                    throw Error('locale not found');
                }

                model[options.relationName].forEach((v) => {

                    if (v.locale === locale) {
                        model[v.column] = v.translation;
                    }
                });

                delete model[options.relationName];

                return model;
            }

            return model;
        }

        static i18nFormat(model, locale) {

            if (!model[options.relationName]) {
                model[options.relationName] = [];
            }

            this.translatable.forEach((name) => {

                const index = model[options.relationName].findIndex((t) => t.locale === locale && t.column === name);

                if (index === -1) {
                    return model[options.relationName].push({
                        locale,
                        column      : name,
                        translation : model[name]
                    });
                }

                model[options.relationName][index].translation = model[name];
            });

            return model;
        }

    }, options.modelName);

    return new Utils.I18nArray(m, translationModel);
};
