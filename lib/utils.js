'use strict';

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

module.exports.I18ObjectionPlugin = (options = { columnName : 'i18n' }) => {

    return (objectionModel) => {

        return class extends objectionModel {

            static get QueryBuilder() {

                return class I18nQueryBuilder extends objectionModel.QueryBuilder {

                    i18n(locale) {

                        this.eager(options.columnName);

                        if (!locale) {
                            return this;
                        }

                        return this.modifyEager(options.columnName, (builder) => {

                            builder.where('locale', locale);
                        });
                    }
                };
            }
        };
    };
};
