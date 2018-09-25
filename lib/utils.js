'use strict';

const LocaleNotFoundError = require('./errors/localeNotFoundError');

module.exports.renameClass = (cls, name) => {

    return ({
        [name] : class extends cls {
        }
    })[name];
};

module.exports.I18nArray = class I18nArray extends Array {

    constructor(model, translation) {

        super();
        this._model       = model;
        this._translation = translation;
        this.push(model, translation);
    }

    get model() {

        return this._model;
    }

    get translation() {

        return this._translation;
    }
};

const format = (model, locale, translatable, relation, defaultLocale) => {

    if (!locale) {
        return model;
    }

    if (locale === defaultLocale) {
        return model;
    }

    if (!model[relation]) {
        model[relation] = [];
    }

    translatable.forEach((column) => {

        const index       = model[relation].findIndex((t) => t.locale === locale && t.column === column);
        const translation = model[column];
        delete model[column];

        if (index === -1) {

            return model[relation].push({
                locale : locale.toUpperCase(),
                column,
                translation
            });

        }

        model[relation][index].translation = translation;
    });

    return model;
};

const translate = (model, locale, relation, options = {}) => {

    if (!locale) {

        return model;
    }

    if (options.defaultLocale && options.defaultLocale === locale) {

        delete model[relation];

        return model;
    }

    let hasLocale = false;

    model[relation].forEach((v) => {

        if (v.locale === locale) {
            model[v.column] = v.translation;
            hasLocale       = true;
        }
    });

    if (!hasLocale && !options.keep) {
        throw new LocaleNotFoundError('locale not found');
    }

    if (options.tag && hasLocale) {
        model[options.tag] = locale;
    }

    delete model[relation];

    return model;
};

module.exports.I18ObjectionPlugin = (options = { relation : 'i18n' }) => {

    const getTranslations = (queryBuilder, model, idColumn) => {

        queryBuilder.eager(options.relation).first();

        if (Array.isArray(idColumn)) {
            idColumn.forEach((col) => {

                queryBuilder.where(col, model[col]);
            });
        }
        else {

            queryBuilder.where(idColumn, model[idColumn]);
        }

        return queryBuilder;
    };

    return (objectionModel) => {

        return class extends objectionModel {

            static get QueryBuilder() {

                return class I18nQueryBuilder extends objectionModel.QueryBuilder {

                    i18n(locale, opts = {}) {

                        this.eager(options.relation);

                        if (!locale) {
                            return this;
                        }

                        locale = locale.toUpperCase();

                        return this.modifyEager(options.relation, (builder) => {

                            builder.where('locale', locale);
                        }).traverse(this.modelClass(), (m) => {

                            return translate(m, locale, options.relation, { ...opts, defaultLocale: options.defaultLocale });
                        });
                    }

                    async patchTranslation(model, locale) {

                        if (locale !== options.defaultLocale) { // Don't fetch the other translations on a default locale update

                            locale                  = locale.toUpperCase();
                            model[options.relation] = (await getTranslations(this.modelClass()
                                .query(), model, this.modelClass().idColumn))[options.relation];
                            model                   = format(model, locale, this.modelClass().translatable, options.relation, options.defaultLocale);
                        }

                        return this.upsertGraphAndFetch(model).traverse(this.modelClass(), (m) => {

                            return translate(m, locale, options.relation, { defaultLocale : options.defaultLocale });
                        });
                    }

                    async deleteTranslation(id, locale) {

                        if (locale === options.defaultLocale) {
                            throw new Error('You can not delete the default locale');
                        }

                        locale = locale.toUpperCase();

                        const model = (await getTranslations(this.modelClass()
                            .query(), { [this.modelClass().idColumn] : id }, this.modelClass().idColumn));

                        model[options.relation] = model[options.relation].filter((translation) => translation.locale !== locale);

                        return this.upsertGraph(model);
                    }
                };
            }
        };
    };
};

module.exports.translate = translate;
module.exports.format    = format;
