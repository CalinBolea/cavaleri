<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260306162105 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE army_slot (id UUID NOT NULL, slot_index INT NOT NULL, unit_id VARCHAR(50) NOT NULL, quantity INT NOT NULL, hero_id UUID NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX IDX_B221C1E945B0BCD ON army_slot (hero_id)');
        $this->addSql('CREATE TABLE game (id UUID NOT NULL, status VARCHAR(20) NOT NULL, current_day INT NOT NULL, current_week INT NOT NULL, current_month INT NOT NULL, current_player_index INT NOT NULL, map_width INT NOT NULL, map_height INT NOT NULL, map_data JSON NOT NULL, created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE TABLE hero (id UUID NOT NULL, name VARCHAR(100) NOT NULL, hero_class VARCHAR(50) NOT NULL, pos_x INT NOT NULL, pos_y INT NOT NULL, movement_points INT NOT NULL, max_movement_points INT NOT NULL, attack INT NOT NULL, defense INT NOT NULL, spell_power INT NOT NULL, knowledge INT NOT NULL, experience INT NOT NULL, level INT NOT NULL, player_id UUID NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX IDX_51CE6E8699E6F5DF ON hero (player_id)');
        $this->addSql('CREATE TABLE player (id UUID NOT NULL, name VARCHAR(100) NOT NULL, faction VARCHAR(50) NOT NULL, color VARCHAR(20) NOT NULL, is_ai BOOLEAN NOT NULL, resources JSON NOT NULL, game_id UUID NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX IDX_98197A65E48FD905 ON player (game_id)');
        $this->addSql('ALTER TABLE army_slot ADD CONSTRAINT FK_B221C1E945B0BCD FOREIGN KEY (hero_id) REFERENCES hero (id) NOT DEFERRABLE');
        $this->addSql('ALTER TABLE hero ADD CONSTRAINT FK_51CE6E8699E6F5DF FOREIGN KEY (player_id) REFERENCES player (id) NOT DEFERRABLE');
        $this->addSql('ALTER TABLE player ADD CONSTRAINT FK_98197A65E48FD905 FOREIGN KEY (game_id) REFERENCES game (id) NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE army_slot DROP CONSTRAINT FK_B221C1E945B0BCD');
        $this->addSql('ALTER TABLE hero DROP CONSTRAINT FK_51CE6E8699E6F5DF');
        $this->addSql('ALTER TABLE player DROP CONSTRAINT FK_98197A65E48FD905');
        $this->addSql('DROP TABLE army_slot');
        $this->addSql('DROP TABLE game');
        $this->addSql('DROP TABLE hero');
        $this->addSql('DROP TABLE player');
    }
}
