<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260306170708 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE neutral_stack (id UUID NOT NULL, pos_x INT NOT NULL, pos_y INT NOT NULL, faction_id VARCHAR(50) NOT NULL, unit_id VARCHAR(50) NOT NULL, quantity INT NOT NULL, game_id UUID NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX IDX_CF170B95E48FD905 ON neutral_stack (game_id)');
        $this->addSql('ALTER TABLE neutral_stack ADD CONSTRAINT FK_CF170B95E48FD905 FOREIGN KEY (game_id) REFERENCES game (id) NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE neutral_stack DROP CONSTRAINT FK_CF170B95E48FD905');
        $this->addSql('DROP TABLE neutral_stack');
    }
}
