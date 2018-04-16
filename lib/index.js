'use strict';

const Hoek  = require('hoek');
const Model = require('schwifty').Model;
const Joi   = require('joi');
const Utils = require('./utils');

module.exports = (baseModel, customOptions = {}) => {

    const options = Hoek.applyToDefaults({
        translationTable : `${baseModel.getTableName()}Translation`,
        translationModel : `${baseModel.getTableName()}Translation`,
        relation         : 'i18n',
        modelName        : baseModel.name
    }, customOptions);

    const translationModel = Utils.renameClass(class extends Model {

        static get tableName() {

            return options.translationTable;
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

    }, options.translationModel);

    const m = Utils.renameClass(class extends Utils.I18ObjectionPlugin()(baseModel) {

        static relationMappings() {

            return Hoek.merge({
                [options.relation] : {
                    relation   : Model.HasManyRelation,
                    modelClass : translationModel,
                    join       : {
                        from : `${super.tableName}.id`,
                        to   : `${translationModel.tableName}.tableId`
                    }
                }
            }, Hoek.reach(baseModel, 'relationMappings', {}));
        }

        static get translatable() {

            const translatable = [];

            const children = super.joiSchema.describe().children;

            Object.keys(children).forEach((v) => {

                const meta = Hoek.reach(children[v], 'meta', { default : [{ translate : false }] });

                if (Hoek.contain(meta, { translate : true }, { deep : true })) {
                    translatable.push(v);
                }
            });

            return translatable;
        }

        static get joiSchema() {

            return super.joiSchema.keys({
                [options.relation] : Joi.array().items({
                    locale      : Joi.string(),
                    column      : Joi.string().allow(this.translatable),
                    translation : Joi.string()
                })
            });
        }

        static translate(model, locale) {

            if (locale) {

                if (!model[options.relation].find((v) => v.locale === locale)) {
                    throw Error('locale not found');
                }

                model[options.relation].forEach((v) => {

                    if (v.locale === locale) {
                        model[v.column] = v.translation;
                    }
                });

                delete model[options.relation];

                return model;
            }

            return model;
        }

        static i18nFormat(model, locale) {

            if (!model[options.relation]) {
                model[options.relation] = [];
            }

            this.translatable.forEach((name) => {

                const index = model[options.relation].findIndex((t) => t.locale === locale && t.column === name);

                if (index === -1) {
                    return model[options.relation].push({
                        locale,
                        column      : name,
                        translation : model[name]
                    });
                }

                model[options.relation][index].translation = model[name];
            });

            return model;
        }

    }, options.modelName);

    return new Utils.I18nArray(m, translationModel);
};
