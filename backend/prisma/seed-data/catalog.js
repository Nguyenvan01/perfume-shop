'use strict';

/**
 * Catalog mẫu cho seed.
 * - Thông tin thực tế (thương hiệu, nồng độ, nhóm hương, tầng hương) tổng hợp từ thông tin
 *   công khai của hãng. Mô tả là văn bản tự viết, không sao chép từ website bán hàng khác.
 * - `origin` = quốc gia của thương hiệu, không phải nơi sản xuất từng lô.
 * - Giá là giá tham khảo để demo, không phải giá thị trường.
 * - Tầng hương ghi trong `notes`; seed ghép vào cuối `description` cho tới khi schema có
 *   cột riêng (S3 trong docs/saas-plan.md).
 */

const BRANDS = [
  { name: 'Dior', description: 'Nhà mốt Pháp, nổi tiếng với những dòng nước hoa kinh điển như Sauvage, J\'adore và Miss Dior.' },
  { name: 'Chanel', description: 'Thương hiệu Pháp gắn liền với Chanel N°5, phong cách thanh lịch và tinh tế vượt thời gian.' },
  { name: 'Versace', description: 'Thương hiệu Ý với hương thơm táo bạo, tươi trẻ, thiết kế chai đậm chất Hy Lạp cổ.' },
  { name: 'Yves Saint Laurent', description: 'Nhà mốt Pháp có các dòng hương hiện đại, cá tính như Libre, Black Opium và Y.' },
  { name: 'Giorgio Armani', description: 'Thương hiệu Ý theo đuổi vẻ đẹp tối giản, nổi bật với dòng Acqua di Giò.' },
  { name: 'Tom Ford', description: 'Thương hiệu Mỹ cao cấp, dòng Private Blend nổi tiếng với hương gỗ, da thuộc và oud sang trọng.' },
  { name: 'Jo Malone London', description: 'Thương hiệu Anh với các mùi hương đơn giản, trong trẻo, dễ phối (layering) với nhau.' },
  { name: 'Le Labo', description: 'Nhà hương niche từ New York, chai được pha và dán nhãn thủ công tại cửa hàng.' },
  { name: 'Maison Francis Kurkdjian', description: 'Nhà hương Pháp của nghệ nhân Francis Kurkdjian, chủ nhân của Baccarat Rouge 540.' },
  { name: 'Creed', description: 'Nhà hương lâu đời có trụ sở tại Paris, nổi tiếng với Aventus dành cho nam.' },
  { name: 'Gucci', description: 'Nhà mốt Ý với các dòng hương nữ tính hiện đại như Bloom và Flora.' },
  { name: 'Hermès', description: 'Thương hiệu xa xỉ Pháp, hương thơm mang tính nghệ thuật, chú trọng chất liệu tự nhiên.' },
  { name: 'Lancôme', description: 'Thương hiệu mỹ phẩm Pháp, dòng La Vie Est Belle là một trong những mùi bán chạy nhất thế giới.' },
  { name: 'Carolina Herrera', description: 'Thương hiệu thời trang Mỹ, nổi bật với chai Good Girl hình gót giày.' },
  { name: 'Paco Rabanne', description: 'Nhà mốt Pháp với các thiết kế chai độc đáo như thỏi vàng 1 Million.' },
  { name: 'Byredo', description: 'Nhà hương niche Thụy Điển, mùi hương tối giản lấy cảm hứng từ ký ức và hành trình.' },
  { name: 'Prada', description: 'Nhà mốt Ý với hương thơm sạch, thanh lịch, thường lấy iris làm điểm nhấn.' },
  { name: 'Narciso Rodriguez', description: 'Thương hiệu Mỹ nổi tiếng với nốt xạ hương (musk) mềm mại, gợi cảm.' },
  { name: 'Valentino', description: 'Nhà mốt Ý, dòng Born in Roma mang tinh thần Rome hiện đại và phá cách.' },
  { name: 'Montblanc', description: 'Thương hiệu Đức về bút và phụ kiện, nước hoa nam dễ dùng với mức giá vừa phải.' },
  { name: 'Jean Paul Gaultier', description: 'Nhà mốt Pháp với chai hình thân người mang tính biểu tượng của dòng Le Male.' },
];

const CATEGORIES = [
  { name: 'Nước hoa nam', description: 'Hương thơm dành cho nam giới.' },
  { name: 'Nước hoa nữ', description: 'Hương thơm dành cho nữ giới.' },
  { name: 'Unisex', description: 'Hương thơm dùng được cho cả nam và nữ.' },
  { name: 'Gift Set', description: 'Bộ quà tặng nhiều sản phẩm.' },
  { name: 'Mini', description: 'Chai dung tích nhỏ, tiện mang theo.' },
];

const MALE = { gender: 'MALE', category: 'Nước hoa nam' };
const FEMALE = { gender: 'FEMALE', category: 'Nước hoa nữ' };
const UNISEX = { gender: 'UNISEX', category: 'Unisex' };

const PRODUCTS = [
  // ── Dior ───────────────────────────────────────────────────────────────
  {
    name: 'Dior Sauvage Eau de Parfum',
    brand: 'Dior', ...MALE, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Woody Aromatic',
    description: 'Phiên bản EDP của Sauvage ấm và tròn hơn bản EDT nhờ chút vani. Mở đầu bằng cam bergamot tươi mát, sau đó là tiêu Tứ Xuyên cay nhẹ, nền ambroxan nam tính, lưu hương tốt. Dễ dùng hằng ngày, đi làm lẫn đi chơi.',
    notes: { top: 'Cam bergamot', heart: 'Tiêu Tứ Xuyên, oải hương, hồi, nhục đậu khấu', base: 'Ambroxan, vani' },
    skuPrefix: 'DIOR-SAUV-EDP',
    variants: [
      { volume_ml: 30, price: 2150000, stock: 40 },
      { volume_ml: 60, price: 3250000, stock: 25 },
      { volume_ml: 100, price: 4150000, sale_price: 3890000, stock: 18 },
      { volume_ml: 200, price: 6250000, stock: 4 },
    ],
  },
  {
    name: 'Dior Sauvage Elixir',
    brand: 'Dior', ...MALE, origin: 'Pháp', concentration: 'PARFUM',
    fragrance_family: 'Amber Spicy',
    description: 'Bản nồng độ cao nhất của dòng Sauvage, đậm đặc và cay ấm. Quế, nhục đậu khấu và bạch đậu khấu mở đầu, oải hương ở giữa, nền cam thảo và gỗ đàn hương. Hợp buổi tối và thời tiết mát, chỉ cần 1–2 lần xịt.',
    notes: { top: 'Quế, nhục đậu khấu, bạch đậu khấu, bưởi', heart: 'Oải hương', base: 'Cam thảo, gỗ đàn hương, hổ phách, hoắc hương, cỏ hương bài' },
    skuPrefix: 'DIOR-SAUV-ELX',
    variants: [
      { volume_ml: 60, price: 3950000, stock: 12 },
      { volume_ml: 100, price: 5350000, stock: 6 },
    ],
  },
  {
    name: 'Dior Homme Intense',
    brand: 'Dior', ...MALE, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Woody Floral Musk',
    description: 'Mùi hương nam tính kiểu lịch lãm, xoay quanh hoa diên vĩ (iris) mịn như phấn. Lê và hạt vông vang tạo độ ngọt nhẹ, nền cỏ hương bài và tuyết tùng. Phù hợp công sở, sự kiện trang trọng và mùa thu đông.',
    notes: { top: 'Oải hương', heart: 'Diên vĩ, hạt vông vang, lê', base: 'Cỏ hương bài, tuyết tùng' },
    skuPrefix: 'DIOR-HOMME-INT',
    variants: [
      { volume_ml: 50, price: 2950000, stock: 10 },
      { volume_ml: 100, price: 4050000, stock: 7 },
    ],
  },
  {
    name: 'Dior Miss Dior Blooming Bouquet',
    brand: 'Dior', ...FEMALE, origin: 'Pháp', concentration: 'EDT',
    fragrance_family: 'Floral',
    description: 'Bó hoa nhẹ nhàng, tươi tắn với mẫu đơn và hồng Damascus trên nền xạ hương trắng sạch sẽ. Mùi dịu, không gắt, rất hợp các bạn nữ trẻ và thời tiết nóng ẩm.',
    notes: { top: 'Quýt Sicily', heart: 'Mẫu đơn, hồng Damascus, mơ, đào', base: 'Xạ hương trắng' },
    skuPrefix: 'DIOR-MDBB-EDT',
    variants: [
      { volume_ml: 30, price: 1950000, stock: 30 },
      { volume_ml: 50, price: 2850000, stock: 22 },
      { volume_ml: 100, price: 4050000, stock: 3 },
    ],
  },
  {
    name: 'Dior J\'adore Eau de Parfum',
    brand: 'Dior', ...FEMALE, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Floral Fruity',
    description: 'Biểu tượng hương hoa nữ tính của Dior: một bó hoa lớn với nhài, hồng và hoa huệ, mở đầu bằng lê và dưa ngọt mát. Sang trọng, nữ tính, hợp dịp quan trọng và phụ nữ trưởng thành.',
    notes: { top: 'Lê, dưa lưới, cam bergamot', heart: 'Hoa nhài, hoa hồng, hoa huệ (tuberose)', base: 'Xạ hương, vani, tuyết tùng' },
    skuPrefix: 'DIOR-JADORE-EDP',
    variants: [
      { volume_ml: 30, price: 2450000, stock: 15 },
      { volume_ml: 50, price: 3350000, stock: 11 },
      { volume_ml: 100, price: 4650000, stock: 5 },
    ],
  },

  // ── Chanel ─────────────────────────────────────────────────────────────
  {
    name: 'Chanel Bleu de Chanel Eau de Parfum',
    brand: 'Chanel', ...MALE, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Woody Aromatic',
    description: 'Mùi nam an toàn và sang trọng bậc nhất: bưởi, chanh và bạc hà tươi mát, chuyển dần sang gừng, nhục đậu khấu rồi nền trầm hương, tuyết tùng, gỗ đàn hương. Hợp mọi độ tuổi, mọi hoàn cảnh.',
    notes: { top: 'Bưởi, chanh, bạc hà, tiêu hồng', heart: 'Gừng, nhục đậu khấu, hoa nhài', base: 'Trầm hương, tuyết tùng, gỗ đàn hương, hoắc hương' },
    skuPrefix: 'CHANEL-BLEU-EDP',
    variants: [
      { volume_ml: 50, price: 3450000, stock: 20 },
      { volume_ml: 100, price: 4650000, sale_price: 4390000, stock: 15 },
      { volume_ml: 150, price: 6150000, stock: 5 },
    ],
  },
  {
    name: 'Chanel Coco Mademoiselle',
    brand: 'Chanel', ...FEMALE, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Chypre Floral',
    description: 'Hương thơm của người phụ nữ độc lập: cam tươi sáng mở đầu, hoa hồng và nhài ở giữa, nền hoắc hương và cỏ hương bài sâu lắng. Thanh lịch, dễ nhận ra, hợp công sở.',
    notes: { top: 'Cam, cam bergamot, bưởi', heart: 'Hoa hồng, hoa nhài', base: 'Hoắc hương, cỏ hương bài, vani, xạ hương trắng' },
    skuPrefix: 'CHANEL-COCO-EDP',
    variants: [
      { volume_ml: 35, price: 2750000, stock: 26 },
      { volume_ml: 50, price: 3950000, stock: 14 },
      { volume_ml: 100, price: 5450000, stock: 2 },
    ],
  },
  {
    name: 'Chanel N°5 Eau de Parfum',
    brand: 'Chanel', ...FEMALE, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Floral Aldehyde',
    description: 'Chai nước hoa nổi tiếng nhất lịch sử. Aldehyde tạo cảm giác lấp lánh, sạch sẽ, nền là bó hoa nhài và hồng kinh điển trên gỗ đàn hương, vani. Cổ điển, quý phái, hợp phụ nữ yêu phong cách truyền thống.',
    notes: { top: 'Aldehyde, hoa cam neroli, ngọc lan tây, cam bergamot', heart: 'Hoa nhài, hoa hồng, diên vĩ, linh lan', base: 'Gỗ đàn hương, vani, cỏ hương bài, xạ hương' },
    skuPrefix: 'CHANEL-N5-EDP',
    variants: [
      { volume_ml: 35, price: 2850000, stock: 9 },
      { volume_ml: 50, price: 3950000, stock: 8 },
      { volume_ml: 100, price: 5650000, stock: 4 },
    ],
  },
  {
    name: 'Chanel Chance Eau Tendre',
    brand: 'Chanel', ...FEMALE, origin: 'Pháp', concentration: 'EDT',
    fragrance_family: 'Floral Fruity',
    description: 'Phiên bản dịu dàng nhất của dòng Chance: bưởi và mộc qua trong trẻo, hoa lục bình và nhài mềm mại, nền xạ hương trắng. Nhẹ nhàng, tươi trẻ, hợp mùa hè và người mới dùng nước hoa.',
    notes: { top: 'Bưởi, mộc qua', heart: 'Lục bình, hoa nhài', base: 'Xạ hương trắng, diên vĩ, tuyết tùng, hổ phách' },
    skuPrefix: 'CHANEL-CHANCE-ET',
    variants: [
      { volume_ml: 50, price: 3150000, stock: 18 },
      { volume_ml: 100, price: 4350000, stock: 9 },
    ],
  },

  // ── Versace ────────────────────────────────────────────────────────────
  {
    name: 'Versace Eros Eau de Toilette',
    brand: 'Versace', ...MALE, origin: 'Ý', concentration: 'EDT',
    fragrance_family: 'Aromatic Fougere',
    description: 'Mùi nam ngọt và nổi bật: bạc hà, táo xanh mát lạnh mở đầu, đậu tonka ở giữa, nền vani ấm áp. Toả hương mạnh, được giới trẻ yêu thích khi đi chơi, hẹn hò buổi tối.',
    notes: { top: 'Bạc hà, táo xanh, chanh', heart: 'Đậu tonka, ambroxan, phong lữ', base: 'Vani Madagascar, tuyết tùng, cỏ hương bài, rêu sồi' },
    skuPrefix: 'VERSACE-EROS-EDT',
    variants: [
      { volume_ml: 30, price: 1150000, stock: 50 },
      { volume_ml: 50, price: 1650000, stock: 35 },
      { volume_ml: 100, price: 2250000, sale_price: 1990000, stock: 28 },
    ],
  },
  {
    name: 'Versace Dylan Blue Pour Homme',
    brand: 'Versace', ...MALE, origin: 'Ý', concentration: 'EDT',
    fragrance_family: 'Aromatic Fougere',
    description: 'Hương biển tươi mát pha chút gỗ: cam bergamot, bưởi, lá sung, chuyển sang tiêu đen và hoắc hương, nền xạ hương khoáng và trầm hương. Lựa chọn giá tốt cho đi làm hằng ngày.',
    notes: { top: 'Cam bergamot, bưởi, lá sung, hương nước', heart: 'Lá violet, giấy cói, tiêu đen, hoắc hương', base: 'Xạ hương khoáng, đậu tonka, nghệ tây, trầm hương' },
    skuPrefix: 'VERSACE-DYLAN-EDT',
    variants: [
      { volume_ml: 50, price: 1550000, stock: 24 },
      { volume_ml: 100, price: 2150000, stock: 16 },
    ],
  },
  {
    name: 'Versace Bright Crystal',
    brand: 'Versace', ...FEMALE, origin: 'Ý', concentration: 'EDT',
    fragrance_family: 'Floral Fruity',
    description: 'Hương hoa quả trong trẻo, mát như pha lê: thanh yên (yuzu), lựu chín, mẫu đơn và mộc lan. Nhẹ, sạch, rất dễ dùng trong thời tiết nóng.',
    notes: { top: 'Yuzu, lựu', heart: 'Mẫu đơn, mộc lan, hoa sen', base: 'Xạ hương, gỗ gụ, hổ phách' },
    skuPrefix: 'VERSACE-BRIGHT-EDT',
    variants: [
      { volume_ml: 30, price: 1050000, stock: 30 },
      { volume_ml: 90, price: 1950000, stock: 14 },
    ],
  },

  // ── Yves Saint Laurent ─────────────────────────────────────────────────
  {
    name: 'Yves Saint Laurent Y Eau de Parfum',
    brand: 'Yves Saint Laurent', ...MALE, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Aromatic Fougere',
    description: 'Mùi nam hiện đại, sạch và tươi: táo, gừng mở đầu, xô thơm và bách xù ở giữa, nền gỗ hổ phách và đậu tonka ngọt nhẹ. Lịch sự, dễ được khen, hợp đi làm.',
    notes: { top: 'Táo, gừng, cam bergamot', heart: 'Xô thơm, quả bách xù, phong lữ', base: 'Gỗ hổ phách, đậu tonka, tuyết tùng, cỏ hương bài' },
    skuPrefix: 'YSL-Y-EDP',
    variants: [
      { volume_ml: 60, price: 2650000, stock: 17 },
      { volume_ml: 100, price: 3450000, stock: 11 },
    ],
  },
  {
    name: 'Yves Saint Laurent Libre Eau de Parfum',
    brand: 'Yves Saint Laurent', ...FEMALE, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Amber Fougere',
    description: 'Sự kết hợp lạ giữa oải hương (thường thấy ở nước hoa nam) và hoa cam nữ tính, trên nền vani Madagascar. Tự tin, hiện đại, hợp phụ nữ cá tính.',
    notes: { top: 'Oải hương, quýt, lý chua đen', heart: 'Hoa cam, hoa nhài, oải hương', base: 'Vani Madagascar, xạ hương, tuyết tùng, long diên hương' },
    skuPrefix: 'YSL-LIBRE-EDP',
    variants: [
      { volume_ml: 30, price: 2150000, stock: 20 },
      { volume_ml: 50, price: 2950000, stock: 13 },
      { volume_ml: 90, price: 3950000, stock: 6 },
    ],
  },
  {
    name: 'Yves Saint Laurent Black Opium Eau de Parfum',
    brand: 'Yves Saint Laurent', ...FEMALE, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Amber Vanilla',
    description: 'Hương ngọt ấm gây nghiện với cà phê đen và vani, điểm thêm lê và tiêu hồng. Quyến rũ, bám lâu, hợp buổi tối và mùa lạnh.',
    notes: { top: 'Lê, tiêu hồng, hoa cam', heart: 'Cà phê, hoa nhài, hạnh nhân đắng, cam thảo', base: 'Vani, hoắc hương, tuyết tùng, gỗ cashmere' },
    skuPrefix: 'YSL-BLACKOP-EDP',
    variants: [
      { volume_ml: 30, price: 2050000, stock: 22 },
      { volume_ml: 50, price: 2850000, stock: 12 },
      { volume_ml: 90, price: 3750000, stock: 5 },
    ],
  },

  // ── Giorgio Armani ─────────────────────────────────────────────────────
  {
    name: 'Giorgio Armani Acqua di Giò Pour Homme',
    brand: 'Giorgio Armani', ...MALE, origin: 'Ý', concentration: 'EDT',
    fragrance_family: 'Aromatic Aquatic',
    description: 'Huyền thoại hương biển cho nam: chanh, cam bergamot tươi mát, hương biển và hương thảo, nền xạ hương và tuyết tùng. Sạch sẽ, nhẹ nhàng, hợp khí hậu nóng.',
    notes: { top: 'Chanh xanh, chanh vàng, cam bergamot', heart: 'Hương biển, hoa nhài, hương thảo', base: 'Xạ hương trắng, tuyết tùng, hoắc hương' },
    skuPrefix: 'ARMANI-ADG-EDT',
    variants: [
      { volume_ml: 50, price: 1850000, stock: 26 },
      { volume_ml: 100, price: 2550000, sale_price: 2350000, stock: 19 },
      { volume_ml: 200, price: 3650000, stock: 3 },
    ],
  },
  {
    name: 'Giorgio Armani Sì Eau de Parfum',
    brand: 'Giorgio Armani', ...FEMALE, origin: 'Ý', concentration: 'EDP',
    fragrance_family: 'Chypre Fruity',
    description: 'Lý chua đen (cassis) ngọt mọng mở đầu, hoa hồng và lan Nam Phi ở giữa, nền vani và hoắc hương. Nữ tính, thanh lịch mà vẫn ấm áp.',
    notes: { top: 'Lý chua đen', heart: 'Hoa hồng tháng Năm, lan Nam Phi (freesia)', base: 'Vani, hoắc hương, ambroxan, hương gỗ' },
    skuPrefix: 'ARMANI-SI-EDP',
    variants: [
      { volume_ml: 30, price: 1950000, stock: 15 },
      { volume_ml: 50, price: 2650000, stock: 10 },
      { volume_ml: 100, price: 3650000, stock: 4 },
    ],
  },
  {
    name: 'Giorgio Armani Code Pour Homme',
    brand: 'Giorgio Armani', ...MALE, origin: 'Ý', concentration: 'EDT',
    fragrance_family: 'Amber Spicy',
    description: 'Mùi nam gợi cảm cho buổi tối: chanh, cam bergamot sáng, hoa ô liu và hồi ở giữa, nền da thuộc, đậu tonka và thuốc lá. Ấm áp, lịch lãm.',
    notes: { top: 'Chanh, cam bergamot', heart: 'Hồi sao, hoa ô liu, gỗ guaiac', base: 'Da thuộc, đậu tonka, thuốc lá' },
    skuPrefix: 'ARMANI-CODE-EDT',
    variants: [
      { volume_ml: 75, price: 2250000, stock: 13 },
      { volume_ml: 125, price: 2950000, stock: 6 },
    ],
  },

  // ── Tom Ford ───────────────────────────────────────────────────────────
  {
    name: 'Tom Ford Ombré Leather',
    brand: 'Tom Ford', ...UNISEX, origin: 'Mỹ', concentration: 'EDP',
    fragrance_family: 'Leather',
    description: 'Mùi da thuộc mềm, khô và hoang dã như sa mạc miền Tây nước Mỹ. Bạch đậu khấu mở đầu, da thuộc và nhài sambac ở giữa, nền hổ phách và rêu. Mạnh mẽ, cá tính.',
    notes: { top: 'Bạch đậu khấu', heart: 'Da thuộc, hoa nhài sambac', base: 'Hổ phách, rêu, hoắc hương' },
    skuPrefix: 'TOMFORD-OMBRE-EDP',
    variants: [
      { volume_ml: 50, price: 3850000, stock: 8 },
      { volume_ml: 100, price: 5250000, stock: 5 },
    ],
  },
  {
    name: 'Tom Ford Tobacco Vanille',
    brand: 'Tom Ford', ...UNISEX, origin: 'Mỹ', concentration: 'EDP',
    fragrance_family: 'Amber Spicy',
    description: 'Thuộc dòng Private Blend: lá thuốc lá khô hòa với vani, ca cao và trái cây sấy, ấm và ngọt như một quán cà phê cổ. Rất bám, hợp mùa lạnh và buổi tối.',
    notes: { top: 'Lá thuốc lá, hương gia vị', heart: 'Vani, ca cao, đậu tonka, hoa thuốc lá', base: 'Trái cây sấy khô, hương gỗ' },
    skuPrefix: 'TOMFORD-TOBVAN-EDP',
    variants: [
      { volume_ml: 50, price: 7250000, stock: 4 },
      { volume_ml: 100, price: 10450000, stock: 2 },
    ],
  },
  {
    name: 'Tom Ford Oud Wood',
    brand: 'Tom Ford', ...UNISEX, origin: 'Mỹ', concentration: 'EDP',
    fragrance_family: 'Amber Woody',
    description: 'Gỗ trầm (oud) được làm mềm và dễ dùng: gỗ hồng mộc, bạch đậu khấu, đàn hương, nền đậu tonka và vani. Sang trọng, trầm ấm, phù hợp người lần đầu thử mùi oud.',
    notes: { top: 'Gỗ hồng mộc, bạch đậu khấu, tiêu Trung Hoa', heart: 'Trầm hương (oud), gỗ đàn hương, cỏ hương bài', base: 'Đậu tonka, vani, hổ phách' },
    skuPrefix: 'TOMFORD-OUDWOOD-EDP',
    variants: [
      { volume_ml: 50, price: 7250000, stock: 5 },
      { volume_ml: 100, price: 10450000, stock: 1 },
    ],
  },

  // ── Jo Malone London ───────────────────────────────────────────────────
  {
    name: 'Jo Malone Wood Sage & Sea Salt Cologne',
    brand: 'Jo Malone London', ...UNISEX, origin: 'Anh', concentration: 'EDC',
    fragrance_family: 'Aromatic',
    description: 'Gợi cảm giác đi dạo trên bờ biển nước Anh: muối biển mằn mặn, xô thơm và hạt vông vang. Nhẹ, tự nhiên, dễ phối với các mùi khác của Jo Malone.',
    notes: { top: 'Hạt vông vang', heart: 'Muối biển', base: 'Xô thơm' },
    skuPrefix: 'JOMALONE-WSSS-EDC',
    variants: [
      { volume_ml: 30, price: 1950000, stock: 14 },
      { volume_ml: 100, price: 3850000, stock: 7 },
    ],
  },
  {
    name: 'Jo Malone English Pear & Freesia Cologne',
    brand: 'Jo Malone London', ...FEMALE, origin: 'Anh', concentration: 'EDC',
    fragrance_family: 'Floral Fruity',
    description: 'Lê chín mọng nước kết hợp hoa lan Nam Phi (freesia) trắng, nền hoắc hương nhẹ. Tươi tắn, thanh lịch, hợp đi làm và mùa thu.',
    notes: { top: 'Lê, dưa lưới', heart: 'Lan Nam Phi (freesia), hoa hồng', base: 'Hoắc hương, đại hoàng, xạ hương trắng' },
    skuPrefix: 'JOMALONE-EPF-EDC',
    variants: [
      { volume_ml: 30, price: 1950000, stock: 16 },
      { volume_ml: 100, price: 3850000, stock: 6 },
    ],
  },

  // ── Le Labo ────────────────────────────────────────────────────────────
  {
    name: 'Le Labo Santal 33',
    brand: 'Le Labo', ...UNISEX, origin: 'Mỹ', concentration: 'EDP',
    fragrance_family: 'Woody Aromatic',
    description: 'Mùi gỗ đàn hương khô, hơi da thuộc, pha bạch đậu khấu và violet, rất dễ nhận ra. Mang tinh thần tự do, phóng khoáng; một trong những mùi niche nổi tiếng nhất.',
    notes: { top: 'Bạch đậu khấu, violet', heart: 'Diên vĩ, giấy cói', base: 'Gỗ đàn hương Úc, tuyết tùng, da thuộc' },
    skuPrefix: 'LELABO-SANTAL33-EDP',
    variants: [
      { volume_ml: 50, price: 6150000, stock: 6 },
      { volume_ml: 100, price: 8950000, stock: 3 },
    ],
  },
  {
    name: 'Le Labo Another 13',
    brand: 'Le Labo', ...UNISEX, origin: 'Mỹ', concentration: 'EDP',
    fragrance_family: 'Musk',
    description: 'Mùi “da thịt” sạch và ấm từ ambroxan và xạ hương, điểm chút lê, táo và rêu. Gần da, tinh tế, hợp người thích sự kín đáo.',
    notes: { top: 'Lê, táo', heart: 'Hạt vông vang, hoa nhài', base: 'Ambroxan, xạ hương, rêu' },
    skuPrefix: 'LELABO-ANOTHER13-EDP',
    variants: [
      { volume_ml: 50, price: 6150000, stock: 4 },
      { volume_ml: 100, price: 8950000, stock: 2 },
    ],
  },

  // ── Niche khác ─────────────────────────────────────────────────────────
  {
    name: 'Maison Francis Kurkdjian Baccarat Rouge 540',
    brand: 'Maison Francis Kurkdjian', ...UNISEX, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Amber Floral',
    description: 'Hương thơm như kẹo đường cháy và gỗ: nghệ tây, nhài, gỗ hổ phách và nhựa linh sam. Toả hương xa, bám rất lâu, cực kỳ dễ được hỏi “bạn dùng nước hoa gì”.',
    notes: { top: 'Nghệ tây, hoa nhài', heart: 'Gỗ hổ phách, long diên hương', base: 'Nhựa linh sam, tuyết tùng' },
    skuPrefix: 'MFK-BR540-EDP',
    variants: [
      { volume_ml: 70, price: 8650000, stock: 5 },
      { volume_ml: 200, price: 17850000, stock: 1 },
    ],
  },
  {
    name: 'Creed Aventus',
    brand: 'Creed', ...MALE, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Chypre Fruity',
    description: 'Mùi nam quyền lực nổi tiếng với dứa và gỗ bạch dương hun khói, thêm cam bergamot, táo, nền xạ hương và rêu sồi. Tự tin, sang trọng, hợp doanh nhân.',
    notes: { top: 'Dứa, cam bergamot, lý chua đen, táo', heart: 'Gỗ bạch dương, hoắc hương, hoa nhài, hoa hồng', base: 'Xạ hương, rêu sồi, long diên hương, vani' },
    skuPrefix: 'CREED-AVENTUS-EDP',
    variants: [
      { volume_ml: 50, price: 7950000, stock: 4 },
      { volume_ml: 100, price: 10950000, stock: 3 },
    ],
  },
  {
    name: 'Byredo Gypsy Water',
    brand: 'Byredo', ...UNISEX, origin: 'Thụy Điển', concentration: 'EDP',
    fragrance_family: 'Woody Aromatic',
    description: 'Gợi hình ảnh rừng thông và lửa trại: cam chanh, quả bách xù, lá thông, trầm hương, nền vani và gỗ đàn hương. Tự do, nhẹ nhàng, hợp cả nam và nữ.',
    notes: { top: 'Cam bergamot, chanh, tiêu, quả bách xù', heart: 'Trầm hương, lá thông, diên vĩ', base: 'Hổ phách, vani, gỗ đàn hương' },
    skuPrefix: 'BYREDO-GYPSY-EDP',
    variants: [
      { volume_ml: 50, price: 5250000, stock: 6 },
      { volume_ml: 100, price: 7650000, stock: 3 },
    ],
  },

  // ── Designer khác ──────────────────────────────────────────────────────
  {
    name: 'Gucci Bloom Eau de Parfum',
    brand: 'Gucci', ...FEMALE, origin: 'Ý', concentration: 'EDP',
    fragrance_family: 'Floral',
    description: 'Khu vườn hoa trắng dày đặc: hoa huệ (tuberose), nhài và dây giun (Rangoon creeper). Nữ tính, tự nhiên, không quá ngọt.',
    notes: { top: 'Hoa nhài', heart: 'Hoa huệ (tuberose), dây giun (Rangoon creeper)', base: 'Rễ diên vĩ' },
    skuPrefix: 'GUCCI-BLOOM-EDP',
    variants: [
      { volume_ml: 30, price: 1950000, stock: 18 },
      { volume_ml: 50, price: 2750000, stock: 10 },
      { volume_ml: 100, price: 3750000, stock: 4 },
    ],
  },
  {
    name: 'Hermès Terre d\'Hermès',
    brand: 'Hermès', ...MALE, origin: 'Pháp', concentration: 'EDT',
    fragrance_family: 'Woody Spicy',
    description: 'Mùi “đất” mộc mạc mà tinh tế: cam, bưởi tươi sáng trên nền khoáng, tiêu và cỏ hương bài khô. Chín chắn, điềm đạm, hợp quý ông công sở.',
    notes: { top: 'Cam, bưởi', heart: 'Tiêu, phong lữ, hương khoáng (đá lửa)', base: 'Cỏ hương bài, tuyết tùng, hoắc hương, an tức hương' },
    skuPrefix: 'HERMES-TERRE-EDT',
    variants: [
      { volume_ml: 50, price: 2450000, stock: 11 },
      { volume_ml: 100, price: 3350000, stock: 7 },
    ],
  },
  {
    name: 'Lancôme La Vie Est Belle',
    brand: 'Lancôme', ...FEMALE, origin: 'Pháp', concentration: 'EDP',
    fragrance_family: 'Floral Gourmand',
    description: 'Ngọt ngào và vui tươi: lý chua đen, lê mở đầu, diên vĩ và nhài ở giữa, nền kẹo praline và vani. Rất được ưa chuộng, bám lâu, hợp mùa lạnh.',
    notes: { top: 'Lý chua đen, lê', heart: 'Diên vĩ, hoa nhài, hoa cam', base: 'Praline, vani, hoắc hương, đậu tonka' },
    skuPrefix: 'LANCOME-LVEB-EDP',
    variants: [
      { volume_ml: 30, price: 1850000, stock: 21 },
      { volume_ml: 50, price: 2550000, stock: 12 },
      { volume_ml: 100, price: 3550000, sale_price: 3250000, stock: 6 },
    ],
  },
  {
    name: 'Carolina Herrera Good Girl',
    brand: 'Carolina Herrera', ...FEMALE, origin: 'Mỹ', concentration: 'EDP',
    fragrance_family: 'Amber Floral',
    description: 'Hai mặt đối lập trong một chai: hoa huệ và nhài nữ tính, cà phê, hạnh nhân, ca cao và đậu tonka bí ẩn. Quyến rũ, hợp buổi tối và tiệc tùng.',
    notes: { top: 'Hạnh nhân, cà phê, cam bergamot', heart: 'Hoa huệ (tuberose), hoa nhài sambac, hoa cam', base: 'Đậu tonka, ca cao, vani, gỗ đàn hương' },
    skuPrefix: 'CH-GOODGIRL-EDP',
    variants: [
      { volume_ml: 30, price: 1750000, stock: 19 },
      { volume_ml: 50, price: 2450000, stock: 13 },
      { volume_ml: 80, price: 3150000, stock: 5 },
    ],
  },
  {
    name: 'Paco Rabanne 1 Million',
    brand: 'Paco Rabanne', ...MALE, origin: 'Pháp', concentration: 'EDT',
    fragrance_family: 'Amber Spicy',
    description: 'Chai thỏi vàng nổi bật với hương ngọt cay: bưởi, bạc hà, quế, hoa hồng, nền da thuộc và hổ phách. Toả mạnh, hợp giới trẻ và tiệc tối.',
    notes: { top: 'Bưởi, bạc hà, quýt đỏ', heart: 'Hoa hồng, quế, hương gia vị', base: 'Da thuộc, hổ phách, hương gỗ, hoắc hương' },
    skuPrefix: 'PACO-1MIL-EDT',
    variants: [
      { volume_ml: 50, price: 1650000, stock: 23 },
      { volume_ml: 100, price: 2350000, stock: 15 },
      { volume_ml: 200, price: 3450000, stock: 2 },
    ],
  },
  {
    name: 'Prada L\'Homme',
    brand: 'Prada', ...MALE, origin: 'Ý', concentration: 'EDT',
    fragrance_family: 'Woody Floral',
    description: 'Mùi “áo sơ mi trắng mới giặt”: diên vĩ mịn như phấn, hoa cam neroli, tiêu đen, nền hổ phách và gỗ. Sạch sẽ, tinh tế, hợp văn phòng.',
    notes: { top: 'Hoa cam neroli, tiêu đen, bạch đậu khấu', heart: 'Diên vĩ, violet, phong lữ', base: 'Hổ phách, hoắc hương, tuyết tùng, gỗ đàn hương' },
    skuPrefix: 'PRADA-LHOMME-EDT',
    variants: [
      { volume_ml: 50, price: 2250000, stock: 12 },
      { volume_ml: 100, price: 3150000, stock: 7 },
    ],
  },
  {
    name: 'Narciso Rodriguez For Her',
    brand: 'Narciso Rodriguez', ...FEMALE, origin: 'Mỹ', concentration: 'EDT',
    fragrance_family: 'Floral Musk',
    description: 'Biểu tượng của nốt xạ hương: hoa cam và hoa mộc tinh tế trên nền xạ hương, hổ phách mềm mại. Gợi cảm kín đáo, hợp mọi dịp.',
    notes: { top: 'Hoa cam, hoa mộc, cam bergamot', heart: 'Xạ hương, hổ phách', base: 'Vani, hoắc hương, cỏ hương bài' },
    skuPrefix: 'NARCISO-FORHER-EDT',
    variants: [
      { volume_ml: 50, price: 2050000, stock: 14 },
      { volume_ml: 100, price: 2950000, stock: 6 },
    ],
  },
  {
    name: 'Valentino Born in Roma Donna',
    brand: 'Valentino', ...FEMALE, origin: 'Ý', concentration: 'EDP',
    fragrance_family: 'Amber Floral',
    description: 'Hoa nhài kết hợp vani bourbon ấm áp và gỗ cashmere, điểm lý chua đen và tiêu hồng. Hiện đại, gợi cảm, chai đinh tán nổi bật.',
    notes: { top: 'Lý chua đen, tiêu hồng, cam bergamot', heart: 'Hoa nhài sambac, trà nhài', base: 'Vani bourbon, gỗ cashmere, gỗ guaiac' },
    skuPrefix: 'VALENTINO-BIRD-EDP',
    variants: [
      { volume_ml: 30, price: 2150000, stock: 13 },
      { volume_ml: 50, price: 2950000, stock: 8 },
      { volume_ml: 100, price: 3950000, stock: 3 },
    ],
  },
  {
    name: 'Montblanc Explorer',
    brand: 'Montblanc', ...MALE, origin: 'Đức', concentration: 'EDP',
    fragrance_family: 'Woody Aromatic',
    description: 'Mùi nam phiêu lưu: cam bergamot, tiêu hồng, xô thơm, chuyển sang cỏ hương bài và da thuộc, nền ambroxan và hoắc hương. Lựa chọn giá dễ chịu cho người thích phong cách gỗ tươi.',
    notes: { top: 'Cam bergamot, tiêu hồng, xô thơm', heart: 'Cỏ hương bài Haiti, da thuộc', base: 'Ambroxan, gỗ akigalawood, hoắc hương, ca cao' },
    skuPrefix: 'MONTBLANC-EXPL-EDP',
    variants: [
      { volume_ml: 60, price: 1450000, stock: 20 },
      { volume_ml: 100, price: 1950000, sale_price: 1750000, stock: 14 },
    ],
  },
  {
    name: 'Jean Paul Gaultier Le Male',
    brand: 'Jean Paul Gaultier', ...MALE, origin: 'Pháp', concentration: 'EDT',
    fragrance_family: 'Aromatic Fougere',
    description: 'Huyền thoại thập niên 90 trong chai thân người: oải hương, bạc hà, quế, hoa cam, nền vani và đậu tonka ấm ngọt. Sạch sẽ mà quyến rũ, hợp mùa lạnh.',
    notes: { top: 'Oải hương, bạc hà, cam bergamot, bạch đậu khấu', heart: 'Quế, hoa cam, thì là Ai Cập', base: 'Vani, đậu tonka, gỗ đàn hương, hổ phách, tuyết tùng' },
    skuPrefix: 'JPG-LEMALE-EDT',
    variants: [
      { volume_ml: 75, price: 1750000, stock: 17 },
      { volume_ml: 125, price: 2350000, stock: 9 },
    ],
  },
];

/** Mô tả + tầng hương, mỗi tầng một dòng (frontend hiển thị với white-space: pre-line). */
function buildDescription({ description, notes }) {
  return `${description}\n\nHương đầu: ${notes.top}\nHương giữa: ${notes.heart}\nHương cuối: ${notes.base}`;
}

module.exports = { BRANDS, CATEGORIES, PRODUCTS, buildDescription };
