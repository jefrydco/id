export interface OGImageProps {
	title: string;
	description: string;
	publishedAt: Date;
	bgImageBase64: string;
	logoBase64: string;
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function OGImageTemplate({
	title,
	description,
	publishedAt,
	bgImageBase64,
	logoBase64,
}: OGImageProps) {
	return {
		type: "div",
		props: {
			style: {
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				width: "100%",
				height: "100%",
				backgroundImage: `url(${bgImageBase64})`,
				backgroundSize: "cover",
				backgroundPosition: "center",
				padding: "96px",
			},
			children: [
				{
					type: "img",
					props: {
						src: logoBase64,
						width: 80,
						height: 80,
					},
				},
				{
					type: "div",
					props: {
						style: {
							display: "flex",
							flexDirection: "column",
						},
						children: [
							{
								type: "h1",
								props: {
									style: {
										fontSize: "68px",
										fontWeight: 600,
										color: "#1c1c1c",
										lineHeight: 1.2,
										margin: 0,
										wordBreak: "break-word",
									},
									children: title,
								},
							},
							{
								type: "div",
								props: {
									style: {
										display: "flex",
										alignItems: "center",
										marginTop: "24px",
										gap: "16px",
									},
									children: [
										{
											type: "span",
											props: {
												style: {
													fontSize: "40px",
													fontWeight: 500,
													color: "#b4b4b4",
													margin: 0,
												},
												children: description,
											},
										},
										{
											type: "span",
											props: {
												style: {
													fontSize: "40px",
													fontWeight: 500,
													color: "#b4b4b4",
													margin: 0,
												},
												children: "·",
											},
										},
										{
											type: "span",
											props: {
												style: {
													fontSize: "40px",
													fontWeight: 500,
													color: "#b4b4b4",
													margin: 0,
												},
												children: formatDate(publishedAt),
											},
										},
									],
								},
							},
						],
					},
				},
			],
		},
	};
}
