'use strict';

// Load modules

const Code      = require('code');
const Lab       = require('lab');
const { Model } = require('objection');
const Knex      = require('knex');
const Schwifty  = require('schwifty');
const Joi       = require('joi');
const Utils     = require('../lib/utils');

const SchwiftyI18n = require('../lib');

// Test shortcuts

const { describe, it, before } = exports.lab = Lab.script();
const { expect } = Code;

Model.knex(Knex({
    client           : 'sqlite3',
    useNullAsDefault : true,
    connection       : {
        filename : 'test.db'
    }
}));

describe('Utils', () => {

    it('renames class', () => {

        const test = class Test {
        };

        expect(Utils.renameClass(test, 'randomName').name).to.equal('randomName');
    });

    it('i18n array', () => {

        class ToBeTranslated {

        }

        class Translation {

        }

        const array = new Utils.I18nArray(ToBeTranslated, Translation);

        expect(array.length).to.equal(2);
        expect(array.model).to.equal(ToBeTranslated);
        expect(array.translation).to.equal(Translation);
    });

    it('i18n objection plugin', () => {

        class Join extends Model {

            static get tableName() {

                return 'join';
            }
        }

        class Test extends Model {

            static get QueryBuilder() {

                return class extends Model.QueryBuilder {

                    execute() {

                        const builder = {

                            where(column, value) {

                                expect(column).to.equal('locale');
                                expect(value).to.equal('FR');
                            }
                        };

                        expect(this._eagerModifiersAtPath.length).to.equal(1);

                        this._eagerModifiersAtPath[0].modifier(builder);
                    }
                };
            }

            static get tableName() {

                return 'test';
            }

            static relationMappings() {

                return {
                    'i18n' : {
                        relation   : Model.HasManyRelation,
                        modelClass : Join,
                        join       : {
                            from : `test.id`,
                            to   : `join.tableId`
                        }
                    }
                };
            }
        }

        const objectionPlugin   = Utils.I18ObjectionPlugin()(Test);
        const objectionPluginCC = Utils.I18ObjectionPlugin({ columnName : 'translations' })(Test);

        objectionPlugin.query().i18n('fr').execute();

        expect(Utils.I18ObjectionPlugin).to.be.a.function();
        expect(objectionPlugin.QueryBuilder).to.be.a.function();
        expect(objectionPlugin.query().i18n).to.be.a.function();
        expect(objectionPluginCC.query().i18n().hasEager()).to.equal(true);
    });
});

describe('index', () => {

    const base = class Base extends Schwifty.Model {

        static get tableName() {

            return 'base';
        }

        static get joiSchema() {

            return Joi.object({
                id   : Joi.number().integer(),
                name : Joi.string().meta({ translate : true })
            });
        }

    };

    let modelsNoOptions;

    before(() => {

        modelsNoOptions = SchwiftyI18n(base);
    });

    it('should return an array of exactly two items', () => {

        expect(SchwiftyI18n(base).length).to.equal(2);
    });

    it('should return a translation model with default name', () => {

        expect(modelsNoOptions.translation.name).to.equal('baseTranslation');
    });

    it('should return a translation model with correct idColumn', () => {

        expect(modelsNoOptions.translation.idColumn).to.equal(['tableId', 'locale', 'column']);
    });

    it('should return a translation model with different table name', () => {

        const name   = 'AnotherNameForMyTranslationModel';
        const models = SchwiftyI18n(base, { translationTable : name });
        expect(models.translation.tableName).to.equal(name);
    });

    it('should return a translation model with a different class name', () => {

        const name   = 'AnotherNameForMyTranslationModel';
        const models = SchwiftyI18n(base, { translationModel : name });
        expect(models.translation.name).to.equal(name);
    });

    it('should return a translation object with a valid joi object', () => {

        expect(modelsNoOptions.translation.joiObject).to.be.a.object();
        expect(modelsNoOptions.translation.joiObject.tableId).to.exist();
        expect(modelsNoOptions.translation.joiObject.locale).to.exist();
        expect(modelsNoOptions.translation.joiObject.column).to.exist();
        expect(modelsNoOptions.translation.joiObject.translation).to.exist();
    });

    it('should return a model with valid relation mappings', () => {

        const mapping = {
            relation   : Model.HasManyRelation,
            modelClass : modelsNoOptions.translation,
            join       : {
                from : 'base.id',
                to   : 'baseTranslation.tableId'
            }
        };

        expect(modelsNoOptions.model.relationMappings()).to.equal({
            'i18n' : mapping
        });

        const rm           = SchwiftyI18n(base, { relation : 'test' });
        mapping.modelClass = rm.translation;

        expect(rm.model.relationMappings()).to.equal({ test : mapping });

    });

    it('should extend base joi schema to add relation mapping', () => {

        expect(modelsNoOptions.model.joiSchema.describe().children).to.include(['id', 'name', 'i18n']);

        const m = SchwiftyI18n(base, { relation : 'test' });

        expect(m.model.joiSchema.describe().children).to.include(['id', 'name', 'test']);
    });

    describe('translate', () => {

        it('should return the object as is if no locale is passed', () => {

            expect(modelsNoOptions.model.translate({ test : 'test' })).to.equal({ test : 'test' });
        });

        it('should transform the object with given locale', () => {

            expect(modelsNoOptions.model.translate({
                test : 'test',
                i18n : [
                    {
                        locale      : 'fr',
                        column      : 'test',
                        translation : 'traduction'
                    },
                    {
                        locale      : 'de',
                        column      : 'test',
                        translation : 'somethingingerman'
                    }
                ]
            }, 'fr')).to.equal({
                test : 'traduction'
            });

        });

        it('should throw error if locale not found', () => {

            expect(() => {

                return modelsNoOptions.model.translate({
                    test : 'test',
                    i18n : [
                        {
                            locale      : 'fr',
                            column      : 'test',
                            translation : 'traduction'
                        }
                    ]
                }, 'notalocale');
            }).to.throw(SchwiftyI18n.LocaleNotFoundError);
        });

        it('should translate even if missing locales', () => {

            expect(modelsNoOptions.model.translate({
                test : 'test',
                i18n : [
                    {
                        locale      : 'FR',
                        column      : 'test',
                        translation : 'traduction'
                    }
                ]
            }, 'notalocale', { keep : true })).to.equal({ test : 'test' });
        });

        it('should add tag to show the language', () => {

            expect(modelsNoOptions.model.translate({
                test : 'test',
                i18n : [
                    {
                        locale      : 'FR',
                        column      : 'test',
                        translation : 'traduction'
                    }
                ]
            }, 'FR', { tag: 'lang' }).lang).to.equal('FR');
        });
    });

    describe('i18n format', () => {

        it('should return model when locale is defaultLocale', () => {

            const model = {
                id   : 1,
                name : 'test'
            };

            expect(modelsNoOptions.model.i18nFormat(model, 'EN')).to.equal(model);
        });

        it('should return model when no local is given', () => {

            const model = {
                id   : 1,
                name : 'test'
            };

            expect(modelsNoOptions.model.i18nFormat(model)).to.equal(model);
        });

        it('should create correct model for database', () => {

            const model = {
                id   : 1,
                name : 'nom'
            };

            expect(modelsNoOptions.model.i18nFormat(model, 'FR'))
                .to
                .equal({ id : model.id, i18n : [{ locale : 'FR', column : 'name', translation : 'nom' }] });

        });

        it('should override existing translations', () => {

            const model = {
                id   : 1,
                name : 'nom',
                i18n : [{ locale : 'fr', column : 'name', translation : 'oldtranslation' }]
            };

            expect(modelsNoOptions.model.i18nFormat(model, 'fr'))
                .to
                .equal({ id : model.id, i18n : [{ locale : 'fr', column : 'name', translation : 'nom' }] });
        });

        it('should keep any existing locales', () => {

            const model = {
                id   : 1,
                name : 'nom',
                i18n : [{ locale : 'EN', column : 'name', translation : 'name' }]
            };

            expect(modelsNoOptions.model.i18nFormat(model, 'FR').i18n.length).to.equal(2);
            expect(modelsNoOptions.model.i18nFormat(model, 'FR').i18n)
                .to
                .equal([{ locale : 'EN', column : 'name', translation : 'name' }, { locale : 'FR', column : 'name', translation : 'nom' }]);

        });
    });

    describe('translatable', () => {

        it('should define translatable properties', () => {

            expect(modelsNoOptions.model.translatable).to.equal(['name']);
        });

    });
});
