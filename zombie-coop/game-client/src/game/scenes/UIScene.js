import Phaser from 'phaser';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.powerups = [
      { id: 'speed_boost', name: 'Speed Boost', desc: '+20% tốc độ di chuyển', tier: 1 },
      { id: 'regen_aura', name: 'Regen Aura', desc: 'Hồi 1HP/giây', tier: 1 },
      { id: 'iron_skin', name: 'Iron Skin', desc: '+25% giảm sát thương', tier: 2 },
      { id: 'fire_ammo', name: 'Fire Ammo', desc: 'Đạn gây damage theo thời gian', tier: 2 },
      { id: 'explosive_rounds', name: 'Explosive Rounds', desc: 'Đạn nổ AoE nhỏ', tier: 3 },
      { id: 'eagle_eye', name: 'Eagle Eye', desc: '+35% tầm nhìn và phạm vi', tier: 2 },
      { id: 'chain_lightning', name: 'Chain Lightning', desc: 'Sát thương nhảy qua 3 zombie', tier: 3 },
      { id: 'magnetic_pull', name: 'Magnetic Pull', desc: 'Làm chậm zombie lại gần', tier: 1 }
    ];

    this.panel = this.add.container(0, 0);
    this.panel.setVisible(false);

    // Background overlay
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, 1280, 720);
    this.panel.add(bg);

    const title = this.add.text(640, 100, 'CHỌN POWER-UP', { fontSize: '48px', color: '#ffffff' }).setOrigin(0.5);
    this.panel.add(title);

    this.timerText = this.add.text(640, 180, '15', { fontSize: '36px', color: '#ff0000' }).setOrigin(0.5);
    this.panel.add(this.timerText);

    this.cards = [];
    for (let i = 0; i < 3; i++) {
      const card = this.add.container(340 + i * 300, 360);
      
      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x333333, 1);
      cardBg.lineStyle(4, 0xffffff, 1);
      cardBg.fillRect(-120, -160, 240, 320);
      cardBg.strokeRect(-120, -160, 240, 320);
      
      // Invisible interactive zone
      const zone = this.add.zone(0, 0, 240, 320).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        cardBg.clear();
        cardBg.fillStyle(0x555555, 1);
        cardBg.lineStyle(4, 0xffff00, 1);
        cardBg.fillRect(-120, -160, 240, 320);
        cardBg.strokeRect(-120, -160, 240, 320);
      });
      zone.on('pointerout', () => {
        cardBg.clear();
        cardBg.fillStyle(0x333333, 1);
        cardBg.lineStyle(4, 0xffffff, 1);
        cardBg.fillRect(-120, -160, 240, 320);
        cardBg.strokeRect(-120, -160, 240, 320);
      });
      zone.on('pointerdown', () => this.selectPowerup(i));

      const titleTxt = this.add.text(0, -100, 'Name', { fontSize: '24px', color: '#fff' }).setOrigin(0.5);
      const descTxt = this.add.text(0, 0, 'Desc', { fontSize: '18px', color: '#ccc', align: 'center', wordWrap: { width: 200 } }).setOrigin(0.5);
      const tierTxt = this.add.text(0, 100, 'Tier 1', { fontSize: '20px', color: '#0f0' }).setOrigin(0.5);

      card.add([cardBg, zone, titleTxt, descTxt, tierTxt]);
      this.panel.add(card);
      this.cards.push({ titleTxt, descTxt, tierTxt, zone });
    }

    // Listen to GameScene
    const gameScene = this.scene.get('GameScene');
    gameScene.events.on('showVoting', this.showVoting, this);
  }

  showVoting() {
    this.panel.setVisible(true);
    
    // Pick 3 random powerups
    Phaser.Utils.Array.Shuffle(this.powerups);
    this.currentOptions = this.powerups.slice(0, 3);
    
    for (let i = 0; i < 3; i++) {
      const option = this.currentOptions[i];
      this.cards[i].titleTxt.setText(option.name);
      this.cards[i].descTxt.setText(option.desc);
      this.cards[i].tierTxt.setText(`Tier ${option.tier}`);
      // Color tier
      if (option.tier === 1) this.cards[i].tierTxt.setColor('#0f0');
      else if (option.tier === 2) this.cards[i].tierTxt.setColor('#3498db');
      else this.cards[i].tierTxt.setColor('#9b59b6');
    }

    this.timeLeft = 15;
    this.timerText.setText(this.timeLeft.toString());

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.timeLeft--;
        this.timerText.setText(this.timeLeft.toString());
        if (this.timeLeft <= 0) {
          // Auto select random if timeout
          this.selectPowerup(Phaser.Math.Between(0, 2));
        }
      },
      repeat: 14
    });
  }

  selectPowerup(index) {
    if (!this.panel.visible) return;
    this.timerEvent.remove();
    this.panel.setVisible(false);
    
    const selected = this.currentOptions[index];
    const gameScene = this.scene.get('GameScene');
    gameScene.applyPowerup(selected);
  }
}
