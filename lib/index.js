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
        modelName        : baseModel.name,
        defaultLocale    : 'EN'
    }, customOptions);

    const translationModel = Utils.renameClass(class extends Model {

        static get tableName() {

            return options.translationTable;
        }

        static get idColumn() {

            return ['tableId', 'locale', 'column'];
        }

        static get joiObject() {

            return {
                tableId     : Joi.string(),
                locale      : Joi.string().example('EN'),
                column      : Joi.string(),
                translation : Joi.string()
            };
        }

    }, options.translationModel);

    const m = Utils.renameClass(class extends Utils.I18ObjectionPlugin({
        relation      : options.relation,
        defaultLocale : options.defaultLocale
    })(baseModel) {

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

            const children = Hoek.reach(super.joiSchema.describe(), 'children', { default : {} });

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

        static translate(model, locale, opts) {

            return Utils.translate(model, locale, options.relation, opts);
        }

        static i18nFormat(model, locale) {

            return Utils.format(Object.assign({}, model), locale, this.translatable, options.relation, options.defaultLocale);
        }

    }, options.modelName);

    return new Utils.I18nArray(m, translationModel);
};

module.exports.LocaleNotFoundError = require('./errors/localeNotFoundError');
