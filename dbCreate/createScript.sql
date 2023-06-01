drop table if exists lemmas cascade;
create table lemmas
(
    id serial primary key,
    word varchar not null,
    unique(word)
);

drop index if exists lemmasWordIndex;
create index lemmasWordIndex on lemmas(word);

CREATE OR REPLACE FUNCTION updateWordsTrigger()
RETURNS trigger AS $$
BEGIN
    INSERT INTO words(word, lemmaId) VALUES (NEW.word, NEW.id) ON CONFLICT (word) DO UPDATE SET lemmaId = NEW.id WHERE words.word = NEW.word;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wordUpdateINSERTtrigger
AFTER INSERT ON lemmas
FOR EACH ROW
EXECUTE PROCEDURE updateWordsTrigger();


drop table if exists words cascade;
create table words
(
    id serial primary key,
    word varchar not null,
    lemmaId integer references lemmas on delete cascade,
    unique(word)
);

drop index if exists AllWordIndex;
create index AllWordIndex on words(word);


drop table if exists definitions cascade;
create table definitions
(
    id serial primary key,
    definition varchar not null,
    prettiness integer default 0,
    lemmaId integer references lemmas on delete cascade not null
);

drop index if exists definitionWordIndex;
create index definitionWordIndex on definitions(lemmaId);


drop table if exists approvedWords cascade;
create table approvedWords
(
    id serial primary key,
    wordId integer references words on delete cascade
);


drop table if exists configs cascade;
create table configs
(
    id serial primary key,
    config json not null
);


drop table if exists crosswords cascade;
create table crosswords 
(
    id serial primary key,
    crossword json not null
);


drop table if exists crosswordTemplates cascade;
create table crosswordTemplates 
(
    id serial primary key,
    template json not null
);

CREATE OR REPLACE FUNCTION getWordId(w varchar) RETURNS INTEGER LANGUAGE SQL AS
$$
WITH i AS (INSERT INTO lemmas(word) VALUES (w) ON CONFLICT DO NOTHING RETURNING id)
    SELECT id FROM i union all SELECT id FROM lemmas lm WHERE lm.word = w LIMIT 1
$$;

CREATE OR REPLACE FUNCTION insertLemma(w varchar) RETURNS INTEGER LANGUAGE SQL AS
$$
WITH i AS (INSERT INTO lemmas(word) VALUES (w) ON CONFLICT (word) DO NOTHING RETURNING id)
    SELECT id FROM i union all SELECT id FROM lemmas lm WHERE lm.word = w LIMIT 1
$$;

CREATE OR REPLACE FUNCTION updateWordShape(w varchar, identificator integer) RETURNS VOID LANGUAGE SQL AS
$$
INSERT INTO words(word, lemmaId) VALUES (w, identificator) ON CONFLICT (word) DO UPDATE SET lemmaId = identificator WHERE words.word = w;
$$;

CREATE OR REPLACE FUNCTION getApprovedWordId(w varchar) RETURNS INTEGER LANGUAGE SQL AS
$$
WITH i AS (INSERT INTO words(word, lemmaId) VALUES (w, NULL) ON CONFLICT DO NOTHING RETURNING id)
    SELECT id FROM i union all SELECT id FROM words ws WHERE ws.word = w LIMIT 1
$$;

INSERT INTO crosswordTemplates(template) VALUES ({"backgroundImage":"null","backgroundColor":"#2EC0FF","template":[[{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false}],[{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#effe20","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#effe20","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false}],[{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#effe20","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#effe20","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#effe20","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false}],[{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#effe20","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#effe20","letterCell":false},{"hidden":true,"color":"#51f071","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false}],[{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#effe20","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":true,"color":"#FFFFFF","letterCell":false}],[{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#fece20","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":false}],[{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":false}],[{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#3b3b3b","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":true}],[{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#31aa76","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":true,"color":"#FFFFFF","letterCell":false}],[{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":true},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false}],[{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":false,"color":"#51f071","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false},{"hidden":true,"color":"#FFFFFF","letterCell":false}]]})