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

const { describe, it } = exports.lab = Lab.script();
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
                                expect(value).to.equal('fr');
                            }
                        };

                        expect(this._eagerFiltersAtPath.length).to.equal(1);

                        this._eagerFiltersAtPath[0].filter(builder);
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

    it('should return an array of exactly two items', () => {

        expect(SchwiftyI18n(base).length).to.equal(2);
    });

    it('should return a translation model with default name', () => {

        const models = SchwiftyI18n(base);
        expect(models.translation.name).to.equal('baseTranslation');
    });

    it('should return a translation model with different name', () => {

        const name   = 'AnotherNameForMyTranslationModel';
        const models = SchwiftyI18n(base, { translationTable : name });
        expect(models.translation.name).to.equal(name);
        expect(models.translation.tableName).to.equal(name);
    });

    it('should return a translation object with a valid joi object', () => {

        const models = SchwiftyI18n(base);

        expect(models.translation.joiObject).to.be.a.object();
        expect(models.translation.joiObject.id).to.exist();
        expect(models.translation.joiObject.tableId).to.exist();
        expect(models.translation.joiObject.locale).to.exist();
        expect(models.translation.joiObject.column).to.exist();
        expect(models.translation.joiObject.translation).to.exist();
    });

    it('should return a model with valid relation mappings', () => {

        const models = SchwiftyI18n(base);

        const mapping = {
            relation   : Model.HasManyRelation,
            modelClass : models.translation,
            join       : {
                from : 'base.id',
                to   : 'baseTranslation.tableId'
            }
        };

        expect(models.model.relationMappings()).to.equal({
            'i18n' : mapping
        });

        const rm           = SchwiftyI18n(base, { relationName : 'test' });
        mapping.modelClass = rm.translation;

        expect(rm.model.relationMappings()).to.equal({ test : mapping });

    });

    it('should extend base joi schema to add relation mapping', () => {

        const models = SchwiftyI18n(base);

        expect(models.model.joiSchema.describe().children).to.include(['id', 'name', 'i18n']);

        const m = SchwiftyI18n(base, { relationName : 'test' });

        expect(m.model.joiSchema.describe().children).to.include(['id', 'name', 'test']);
    });

    describe('translate', () => {

        it('should return the object as is if no locale is passed', () => {

            const models = SchwiftyI18n(base);

            expect(models.model.translate({ test : 'test' })).to.equal({ test : 'test' });
        });

        it('should transform the object with given locale', () => {

            const models = SchwiftyI18n(base);

            expect(models.model.translate({
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

            const models = SchwiftyI18n(base);

            expect(() => {

                return models.model.translate({
                    test : 'test',
                    i18n : [
                        {
                            locale      : 'fr',
                            column      : 'test',
                            translation : 'traduction'
                        }
                    ]
                }, 'notalocale');
            }).to.throw();
        });
    });

    describe('i18n format', () => {

        it('should create correct model for database', () => {

            const models = SchwiftyI18n(base);

            const b = {
                id   : 1,
                name : 'nom'
            };

            expect(models.model.i18nFormat(b, 'fr')).to.equal({ ...b, i18n : [{ locale : 'fr', column : 'name', translation : b.name }] });

        });

        it('should override existing translations', () => {

            const models = SchwiftyI18n(base);
            const b      = {
                id   : 1,
                name : 'nom',
                i18n : [{ locale : 'fr', column : 'name', translation : 'oldtranslation' }]
            };

            expect(models.model.i18nFormat(b, 'fr')).to.equal({ ...b, i18n : [{ locale : 'fr', column : 'name', translation : b.name }] });
        });

        it('should keep any existing locales', () => {

            const models = SchwiftyI18n(base);
            const b      = {
                id   : 1,
                name : 'nom',
                i18n : [{ locale : 'en', column : 'name', translation : 'name' }]
            };

            expect(models.model.i18nFormat(b, 'fr').i18n.length).to.equal(2);
            expect(models.model.i18nFormat(b, 'fr').i18n)
                .to
                .equal([{ locale : 'en', column : 'name', translation : 'name' }, { locale : 'fr', column : 'name', translation : 'nom' }]);

        });
    });

    describe('translatable', () => {

        it('should define translatable properties', () => {

            const models = SchwiftyI18n(base);

            expect(models.model.translatable).to.equal(['name']);
        });

    });
});
