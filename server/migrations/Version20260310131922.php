<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260310131922 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE town (id UUID NOT NULL, pos_x INT NOT NULL, pos_y INT NOT NULL, faction_id VARCHAR(50) NOT NULL, game_id UUID NOT NULL, owner_id UUID DEFAULT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX IDX_4CE6C7A4E48FD905 ON town (game_id)');
        $this->addSql('CREATE INDEX IDX_4CE6C7A47E3C61F9 ON town (owner_id)');
        $this->addSql('ALTER TABLE town ADD CONSTRAINT FK_4CE6C7A4E48FD905 FOREIGN KEY (game_id) REFERENCES game (id) NOT DEFERRABLE');
        $this->addSql('ALTER TABLE town ADD CONSTRAINT FK_4CE6C7A47E3C61F9 FOREIGN KEY (owner_id) REFERENCES player (id) NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE town DROP CONSTRAINT FK_4CE6C7A4E48FD905');
        $this->addSql('ALTER TABLE town DROP CONSTRAINT FK_4CE6C7A47E3C61F9');
        $this->addSql('DROP TABLE town');
    }
}
