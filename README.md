# Schwifty i18n

A Schwifty i18n plugin

[![Build Status](https://travis-ci.org/PixulHQ/schwifty-i18n.svg?branch=master)](https://travis-ci.org/PixulHQ/schwifty-i18n) [![Coverage Status](https://coveralls.io/repos/github/PixulHQ/schwifty-i18n/badge.svg?branch=master)](https://coveralls.io/github/PixulHQ/schwifty-i18n?branch=master) [![NSP Status](https://nodesecurity.io/orgs/pixulhq/projects/ed277a5f-854b-40f1-8935-e87a94d0f87f/badge)](https://nodesecurity.io/orgs/pixulhq/projects/ed277a5f-854b-40f1-8935-e87a94d0f87f)

Lead Maintainer: [Daniel Cole](https://github.com/optii)

***THIS IS A WORK IN PROGRESS***

## Usage

Create a Schwifty model as per usual:

```javascript

const Model        = require('schwifty').Model;
const Joi          = require('joi');
const SchwiftyI18n = require('schwifty-i18n');

class Category extends Model {

    static get tableName() {

        return 'Category';
    }

    static get joiSchema() {

        return Joi.object(
            id   : Joi.number(),
            title: Joi.string().meta({translate: true})
        );
    }
}

module.exports = SchwiftyI18n(Category);

```

You will need to manually add the migrations, as an example:

```javascript

 knex.schema.createTable('Category', (table) => {

            table.increments('id').primary();
            table.string('name');
 });

 knex.schema.createTable('CategoryTranslation', (table) => {

    table.integer('tableId');
    table.string('locale');
    table.string('column');
    table.string('translation');

    table.foreign('tableId').references('Category.id');
    table.primary(['tableId', 'locale', 'column']);
 });

```

To add translations to a model (the model has to have been created previously with the `defaultLocale`):

```javascript

    const category = { id: 1, name: 'Une catégorie' };

    await Category.query().patchTranslation(category, 'FR');

```

To delete a translation (you can't delete the `defaultLocale`, to do this you must delete the model):

```javascript

    await Category.query().deleteTranslation(1, 'FR');

```


To fetch a specific language:

```javascript

    await Category.query().i18n('FR');
    await Category.query().findById(1).i18n('FR');

```

